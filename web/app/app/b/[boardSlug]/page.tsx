type Props = {
  params: Promise<{ boardSlug: string }>
}

export default async function BoardPage({ params }: Props) {
  const { boardSlug } = await params

  return (
    <div className="p-8">
      <p className="text-sm text-gray-400">Board: {boardSlug}</p>
    </div>
  )
}
