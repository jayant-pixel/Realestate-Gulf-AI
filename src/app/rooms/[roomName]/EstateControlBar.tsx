'use client';

import {
  DisconnectButton,
  StartMediaButton,
  TrackToggle,
  useLocalParticipantPermissions,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

export default function EstateControlBar() {
  const permissions = useLocalParticipantPermissions();
  const canPublishAudio = permissions?.canPublish ?? true;

  return (
    <div className="estate-control-bar">
      <StartMediaButton className="estate-control-bar__button estate-control-bar__button--primary">
        Enable Audio
      </StartMediaButton>
      <TrackToggle
        source={Track.Source.Microphone}
        showIcon
        disabled={!canPublishAudio}
        className="estate-control-bar__button"
      >
        Mic
      </TrackToggle>
      <DisconnectButton className="estate-control-bar__button estate-control-bar__button--danger">
        End Session
      </DisconnectButton>
    </div>
  );
}
