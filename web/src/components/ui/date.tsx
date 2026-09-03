import moment from "moment";

type Props = {
  date?: Date | null
  format?: string
  className?: string
  emptyValue?: string
}

export function DateFormat({ date, format = "MM/DD/YYYY HH:mm", className, emptyValue = "N/A" }: Props) {
  return <span className={className}>{date ? moment(date).format(format) : emptyValue}</span>
}