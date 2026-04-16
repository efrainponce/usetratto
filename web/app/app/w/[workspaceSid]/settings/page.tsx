import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ workspaceSid: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { workspaceSid } = await params
  redirect(`/app/w/${workspaceSid}/settings/profile`)
}
