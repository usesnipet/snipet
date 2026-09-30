export const SVG = ({ svg, className }: { svg: string; className?: string }) => {
  return (
    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} className={className} />
  )
}