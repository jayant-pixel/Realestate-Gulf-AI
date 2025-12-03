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
  params: PageParams;
  searchParams: SearchParams;
}) {
  const { roomName } = params;
  const { slug } = searchParams;

  return <EstateRoomClient roomName={roomName} slug={slug} />;
}
