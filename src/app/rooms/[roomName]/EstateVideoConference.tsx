'use client';

import { useMemo } from 'react';
import { isTrackReference } from '@livekit/components-core';
import {
  ConnectionStateToast,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

import type { AIAvatar, PublicLink } from '@/types/db';

import EstateControlBar from './EstateControlBar';
import EstateOverlay from './EstateOverlay';

interface EstateVideoConferenceProps extends React.HTMLAttributes<HTMLDivElement> {
  visitorName: string;
  roomName: string;
  link?: PublicLink | null;
  avatar?: AIAvatar | null;
}

export default function EstateVideoConference({
  visitorName,
  roomName,
  link,
  avatar,
  ...props
}: EstateVideoConferenceProps) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: true },
      { source: Track.Source.Unknown, withPlaceholder: true },
    ],
    {
      onlySubscribed: false,
    },
  );

  const avatarTrack = useMemo(() => {
    const videoTracks = tracks
      .filter(isTrackReference)
      .filter((track) => track.publication?.kind === Track.Kind.Video);
    if (videoTracks.length === 0) return undefined;

    const agentTrack = videoTracks.find((track) => {
      const attributes = track.participant?.attributes ?? {};
      if (attributes.agentType === 'avatar') return true;
      const identity = track.participant?.identity?.toLowerCase() ?? '';
      return identity.includes('avatar') || identity.includes('estate');
    });

    return agentTrack ?? videoTracks[0];
  }, [tracks]);

  return (
    <div className="estate-room__stage" {...props}>
      <div className="estate-room__video">
        {avatarTrack ? (
          <VideoTrack className="estate-room__video-feed" trackRef={avatarTrack} />
        ) : (
          <div className="estate-room__waiting">
            <div className="estate-room__waiting-card">
              <p className="estate-room__waiting-title">Waiting for Estate Buddy to join the room…</p>
              <p className="estate-room__waiting-subtitle">This usually takes a few seconds.</p>
            </div>
          </div>
        )}

        <div className="estate-room__overlay">
          <EstateOverlay visitorName={visitorName} roomName={roomName} link={link} avatar={avatar} />
        </div>
      </div>

      <div className="estate-room__controls">
        <EstateControlBar />
      </div>

      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
