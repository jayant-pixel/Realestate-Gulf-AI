import EstateRoomClient from './EstateRoomClient';

interface PageParams {
  roomName: string;
}

interface SearchParams {
  slug?: string;
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { roomName } = await params;
  const { slug } = await searchParams;

  return <EstateRoomClient roomName={roomName} slug={slug} />;
}
