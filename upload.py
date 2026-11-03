import argparse
import math
import os
import queue
import re
import sys
import threading
from pathlib import Path

from httpx import HTTPError
from postgrest.exceptions import APIError
import serial
from dotenv import load_dotenv
from supabase import create_client

BAUD_RATE = 9600
SERIAL_READ_TIMEOUT_SECONDS = 0.1
PROJECT_DIR = Path(__file__).resolve().parent
ENV_FILES = (PROJECT_DIR / ".env", PROJECT_DIR / "viola.env")


def parse_tilt_deviation(line: str) -> int | float | None:
    deviation = re.search(
        r"\bdev:\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)",
        line,
        re.IGNORECASE,
    )
    raw_value = deviation.group(1) if deviation else line.strip()
    try:
        value = float(raw_value)
    except ValueError:
        return None

    if not math.isfinite(value):
        return None
    return int(value) if value.is_integer() else value


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read calibrated MPU tilt deviation from an Arduino and insert it into Supabase."
    )
    parser.add_argument(
        "--port",
        default="/dev/cu.usbmodem101",
        help="Arduino serial port (default: /dev/cu.usbmodem101)",
    )
    args = parser.parse_args()

    for env_file in ENV_FILES:
        if env_file.is_file():
            load_dotenv(env_file)

    supabase_url = os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        print(
            "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env or viola.env",
            file=sys.stderr,
        )
        return 1

    client = create_client(supabase_url, supabase_key)
    print(f"Reading {args.port} at {BAUD_RATE} baud. Press Ctrl+C to stop.")

    try:
        with serial.Serial(args.port, BAUD_RATE, timeout=SERIAL_READ_TIMEOUT_SECONDS) as arduino:
            latest_value: queue.Queue[int | float] = queue.Queue(maxsize=1)
            reader_errors: queue.Queue[Exception] = queue.Queue()
            stop_reader = threading.Event()

            def read_serial() -> None:
                try:
                    while not stop_reader.is_set():
                        line = arduino.readline().decode("utf-8", errors="replace").strip()
                        if not line:
                            continue

                        value = parse_tilt_deviation(line)
                        if value is None:
                            print("Skipped a serial line without a numeric tilt value.", file=sys.stderr)
                            continue

                        try:
                            latest_value.put_nowait(value)
                        except queue.Full:
                            try:
                                latest_value.get_nowait()
                            except queue.Empty:
                                pass
                            latest_value.put_nowait(value)
                except (serial.SerialException, OSError) as error:
                    reader_errors.put(error)

            reader = threading.Thread(target=read_serial, daemon=True)
            reader.start()
            try:
                while True:
                    try:
                        error = reader_errors.get_nowait()
                    except queue.Empty:
                        pass
                    else:
                        raise error

                    try:
                        value = latest_value.get(timeout=SERIAL_READ_TIMEOUT_SECONDS)
                    except queue.Empty:
                        continue

                    try:
                        client.table("readings").insert({"value": value}).execute()
                    except (APIError, HTTPError) as error:
                        print(f"Supabase upload failed: {error}", file=sys.stderr)
                        return 1
                    print(
                        f"Uploaded latest calibrated tilt: {value}°"
                    )
            finally:
                stop_reader.set()
                reader.join(timeout=1)
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0
    except (serial.SerialException, OSError) as error:
        print(f"Serial port error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
