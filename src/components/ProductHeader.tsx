import { PRODUCT } from '../product'
import { isDemoMode } from '../lib/supabase'

function ProductText({
  value,
  placeholder,
  className,
}: {
  value: string
  placeholder: string
  className: string
}) {
  return (
    <p className={`${className}${value ? '' : ' placeholder'}`}>
      {value || placeholder}
    </p>
  )
}

export function ProductHeader() {
  return (
    <header className="product-header">
      <ProductText
        className="t-display product-name"
        value={PRODUCT.name}
        placeholder="[제품 이름]"
      />
      <ProductText
        className="t-label product-concept"
        value={PRODUCT.concept}
        placeholder="[제품 컨셉, 한 줄]"
      />
      <ProductText
        className="t-body product-description"
        value={PRODUCT.description}
        placeholder="[제품 설명, 2~3문장]"
      />
      {isDemoMode && (
        <p className="t-caption demo-caption">
          데모 모드, 실제 센서와 연결되지 않음
        </p>
      )}
    </header>
  )
}
