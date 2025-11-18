import { AvatarLandingClient } from './AvatarLandingClient';

interface PageParams {
  slug: string;
}

export default async function AvatarLandingPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;

  return <AvatarLandingClient slug={slug} />;
}
