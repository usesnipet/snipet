import { useGetUsersSuspense } from "@/__generated__/api";

export function HomeContent() {
  const { data } = useGetUsersSuspense({
    take: 10,
    skip: 0,
  })

  return (
    <div>
      <h1>Home Content</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}