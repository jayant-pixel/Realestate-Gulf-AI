LiveKit docs › Making calls › Outbound trunk

---

# SIP outbound trunk

> How to create and configure a outbound trunk to make outgoing calls.

## Overview

After you purchase a phone number and [configure your SIP trunking provider](https://docs.livekit.io/sip/quickstarts/configuring-sip-trunk.md), you need to create an outbound trunk to make outgoing calls. The outbound trunk includes the authentication credentials and the provider's endpoint to use to verify authorization to make calls using the SIP trunking provider's phone number.

To provision an outbound trunk with the SIP Service, use the [`CreateSIPOutboundTrunk`](https://docs.livekit.io/sip/api.md#createsipoutboundtrunk) API. It returns an `SIPOutboundTrunkInfo` object that describes the created SIP trunk. You can query these parameters any time using the `ListSIPOutboundTrunk` API.

## Restricting calls to a region

To originate calls from the same region as the destination phone number, set the `destination_country` parameter for an outbound trunk. This applies region pinning to all calls made through the trunk. When `destination_country` is enabled, outbound calls are routed based on location:

- For countries that LiveKit operates data centers in, calls originate from a server within the country.
- For other countries, calls originate from a server that is closest to that country.

In the unlikely event that the preferred region is non-operational or offline, calls originate from another region nearby. For a full list of supported regions, see [Available regions](https://docs.livekit.io/sip/cloud.md#available-regions).

The `destination_country` parameter accepts a two-letter country code. To learn more, see [CreateSIPOutboundTrunk](https://docs.livekit.io/sip/api.md#createsipoutboundtrunk).

## Create an outbound trunk

The following creates a SIP outbound trunk with username and password authentication. It makes outbound calls from number `+15105550100`.

**LiveKit CLI**:

1. Create a file named `outbound-trunk.json` using your phone number, trunk domain name, and `username` and `password`:

**Twilio**:

```json
{
  "trunk": {
    "name": "My outbound trunk",
    "address": "<my-trunk>.pstn.twilio.com",
    "numbers": ["+15105550100"],
    "authUsername": "<username>",
    "authPassword": "<password>"
  }
}

```

---

**Telnyx**:

```json
{
  "trunk": {
    "name": "My outbound trunk",
    "address": "sip.telnyx.com",
    "numbers": ["+15105550100"],
    "authUsername": "<username>",
    "authPassword": "<password>"
  }
}

```

> ℹ️ **Note**
> 
> Use a regional SIP Signaling Address from [Telnyx SIP Signaling Addresses](https://sip.telnyx.com/#signaling-addresses) for the `address` field. This example config uses the US SIP proxy, `sip.telnyx.com`.
2. Create the outbound trunk using the CLI:

```shell
lk sip outbound create outbound-trunk.json

```

The output of the command returns the trunk ID. Copy it for the next step:

```text
SIPTrunkID: <your-trunk-id>

```

---

**Node.js**:

```typescript
import { SipClient } from 'livekit-server-sdk';

const sipClient = new SipClient(process.env.LIVEKIT_URL,
                                process.env.LIVEKIT_API_KEY,
                                process.env.LIVEKIT_API_SECRET);

// SIP address is the hostname or IP the SIP INVITE is sent to.
// Address format for Twilio: <trunk-name>.pstn.twilio.com
// Address format for Telnyx: sip.telnyx.com
const address = 'sip.telnyx.com';

// An array of one or more provider phone numbers associated with the trunk.
const numbers = ['+12135550100'];

// Trunk options
const trunkOptions = {
  auth_username: '<username>',
  auth_password: '<password>'
};

const trunk = sipClient.createSipOutboundTrunk(
  'My trunk',
  address,
  numbers,
  trunkOptions
);

```

---

**Python**:

```python
import asyncio

from livekit import api
from livekit.protocol.sip import CreateSIPOutboundTrunkRequest, SIPOutboundTrunkInfo

async def main():
  lkapi = api.LiveKitAPI()

  trunk = SIPOutboundTrunkInfo(
    name = "My trunk",
    address = "sip.telnyx.com",
    numbers = ['+12135550100'],
    auth_username = "<username>",
    auth_password = "<password>"
  )

  request = CreateSIPOutboundTrunkRequest(
    trunk = trunk
  )

  trunk = await lkapi.sip.create_sip_outbound_trunk(request)

  print(f"Successfully created {trunk}")

  await lkapi.aclose()

asyncio.run(main())

```

---

**Ruby**:

```ruby
require 'livekit'

name = "My trunk"
address = "sip.telnyx.com"
numbers = ["+12135550100"]
auth_username = "<username>"
auth_password = "<password>"

sip_service = LiveKit::SIPServiceClient.new(
  ENV['LIVEKIT_URL'],
  api_key: ENV['LIVEKIT_API_KEY'],
  api_secret: ENV['LIVEKIT_API_SECRET']
)

resp = sip_service.create_sip_outbound_trunk(
    name,
    address,
    numbers,
    auth_username: auth_username,
    auth_password: auth_password
)

puts resp.data

```

---

**Go**:

```go
package main

import (
  "context"
  "fmt"
  "os"

  lksdk "github.com/livekit/server-sdk-go/v2"
  "github.com/livekit/protocol/livekit"
)

func main() {
  trunkName := "My trunk"
  address := "sip.telnyx.com"
  numbers := []string{"+16265550100"}

  trunkInfo := &livekit.SIPOutboundTrunkInfo{
    Name: trunkName,
    Address: address,
    Numbers: numbers,
  }

  // Create a request
  request := &livekit.CreateSIPOutboundTrunkRequest{
    Trunk: trunkInfo,
  }

  sipClient := lksdk.NewSIPClient(os.Getenv("LIVEKIT_URL"),
                                  os.Getenv("LIVEKIT_API_KEY"),
                                  os.Getenv("LIVEKIT_API_SECRET"))
  
  // Create trunk
  trunk, err := sipClient.CreateSIPOutboundTrunk(context.Background(), request)

  if (err != nil) {
    fmt.Println(err)
  } else {
    fmt.Println(trunk)
  }
}

```

---

**Kotlin**:

```kotlin
import io.livekit.server.SipServiceClient
import io.livekit.server.CreateSipOutboundTrunkOptions


val sipClient = SipServiceClient.createClient(
  host = System.getenv("LIVEKIT_URL").replaceFirst(Regex("^ws"), "http"),
  apiKey = System.getenv("LIVEKIT_API_KEY"),
  secret = System.getenv("LIVEKIT_API_SECRET")
)

val response = sipClient.createSipOutboundTrunk(
    name = "My outbound trunk",
    address = "sip.telnyx.com",
    numbers = listOf("+16265550100"),
    options = CreateSipOutboundTrunkOptions(
        authUsername = "username",
        authPassword = "password"
    )
).execute()

if (!response.isSuccessful) {
    println(response.errorBody())
} else {
    val trunk = response.body()

    if (trunk != null) {
        println("Created outbound trunk: ${trunk.sipTrunkId}")
    }
}

```

---

**LiveKit Cloud**:

1. Sign in to the **LiveKit Cloud** [dashboard](https://cloud.livekit.io/).
2. Select **Telephony** → [**Configuration**](https://cloud.livekit.io/projects/p_/telephony/config).
3. Select **Create new** → **Trunk**.
4. Select the **JSON editor** tab.

> ℹ️ **Note**
> 
> You can also use the **Trunk details** tab to create a trunk. However, the JSON editor allows you to configure all available [parameters](https://docs.livekit.io/sip/api.md#createsipoutboundtrunk).
5. Select **Outbound** for **Trunk direction**.
6. Copy and paste the following text into the editor:

```json
{
  "name": "My outbound trunk",
  "address": "sip.telnyx.com",
  "numbers": [
    "+12135550100"
  ],
  "authUsername": "test_username",
  "authPassword": "test_password"
}

```
7. Select **Create**.

### Calls from any phone number

You can configure an outbound trunk to allow calls from any phone number by setting the `numbers` parameter to an empty string or wildcard character, for example, `*`. This is useful if you want to use the same outbound trunk for all calls or if you want to use a different phone number for each call.

Instead of setting the number on the trunk, you can set the phone number to call from using the `sip_number` parameter for the [CreateSIPParticipant](https://docs.livekit.io/sip/api.md#createsipparticipant) API.

The following example creates an outbound trunk that allows calling from any number, then initiates a call using the outbound trunk.

1. Create an outbound trunk using the CLI.

Create a file named `outbound-trunk.json` and copy and paste the following content:

```json
  {
    "trunk": {
      "name": "My outbound trunk",
      "address": "<my-trunk>.pstn.twilio.com",
      "numbers": ["*"],
      "auth_username": "<username>",
      "auth_password": "<password>"
    }
  }

```

Create the outbound trunk using the CLI:

```shell
lk sip outbound create outbound-trunk.json

```
2. Initiate a call from the number `+15105550100` using the CLI. This number is the phone number configured with your SIP trunk provider. Use the <trunk-id> from the output of the previous step.

Create a file named `participant.json` and copy and paste the following content:

```json
{
  "sip_number": "+15105550100",
  "sip_trunk_id": "<trunk-id>",
  "sip_call_to": "+12135550100",
  "room_name": "open-room",
  "participant_identity": "sip-test",
  "participant_name": "Test call participant",
  "wait_until_answered": true
}

```

> ❗ **Important**
> 
> If you're using Telnyx, the leading `+` in the phone number assumes the `Destination Number Format` is set to `+E.164` for your number.

Initiate the call using the CLI:

```shell
lk sip participant create participant.json

```

After you run the command, a call from the number `+15105550100` to `+12135550100` is initiated. Output from the command returns when the call is answered.

## List outbound trunks

Use the [`ListSIPOutboundTrunk`](https://docs.livekit.io/sip/api.md#listsipoutboundtrunk) API to list all outbound trunks and trunk parameters.

**LiveKit CLI**:

```shell
lk sip outbound list

```

---

**Node.js**:

```typescript
import { SipClient } from 'livekit-server-sdk';

const sipClient = new SipClient(process.env.LIVEKIT_URL,
                                process.env.LIVEKIT_API_KEY,
                                process.env.LIVEKIT_API_SECRET);

const rules = await sipClient.listSipOutboundTrunk();

console.log(rules);

```

---

**Python**:

```python
import asyncio

from livekit import api
from livekit.protocol.sip import ListSIPOutboundTrunkRequest

async def main():
  livekit_api = api.LiveKitAPI()

  rules = await livekit_api.sip.list_sip_outbound_trunk(
    ListSIPOutboundTrunkRequest()
  )
  print(f"{rules}")

  await livekit_api.aclose()

asyncio.run(main())

```

---

**Ruby**:

```ruby
require 'livekit'

sip_service = LiveKit::SIPServiceClient.new(
  ENV['LIVEKIT_URL'],
  api_key: ENV['LIVEKIT_API_KEY'],
  api_secret: ENV['LIVEKIT_API_SECRET']
)

resp = sip_service.list_sip_outbound_trunk()

puts resp.data

```

---

**Go**:

```go
package main

import (
  "context"
  "fmt"
  "os"

  lksdk "github.com/livekit/server-sdk-go/v2"
  "github.com/livekit/protocol/livekit"
)

func main() {

  sipClient := lksdk.NewSIPClient(os.Getenv("LIVEKIT_URL"),
                                  os.Getenv("LIVEKIT_API_KEY"),
                                  os.Getenv("LIVEKIT_API_SECRET"))

  // List dispatch rules
  trunks, err := sipClient.ListSIPOutboundTrunk(
    context.Background(), &livekit.ListSIPOutboundTrunkRequest{})

  if err != nil {
    fmt.Println(err)
  } else {
    fmt.Println(trunks)
  }
}

```

---

**Kotlin**:

```kotlin
import io.livekit.server.SipServiceClient

val sipClient = SipServiceClient.createClient(
  host = System.getenv("LIVEKIT_URL").replaceFirst(Regex("^ws"), "http"),
  apiKey = System.getenv("LIVEKIT_API_KEY"),
  secret = System.getenv("LIVEKIT_API_SECRET")
)

val response = sipClient.listSipOutboundTrunk().execute()

if (!response.isSuccessful) {
  println(response.errorBody())
} else {
  val trunks = response.body()

  if (trunks != null) {
    println("Outbound trunks: ${trunks}")
  }
}

```

---

**LiveKit Cloud**:

1. Sign in to the **LiveKit Cloud** [dashboard](https://cloud.livekit.io/).
2. Select **Telephony** → [**Configuration**](https://cloud.livekit.io/projects/p_/telephony/config).
3. The **Outbound** section lists all outbound trunks.

## Update an outbound trunk

The [`UpdateSIPOutboundTrunk`](https://docs.livekit.io/sip/api.md#updatesipoutboundtrunk) API allows you to update specific fields of an outbound trunk or [replace](#replace-sip-outbound-trunk) an outbound trunk with a new one.

### Update specific fields of an outbound trunk

The `UpdateSIPOutboundTrunkFields` API allows you to update specific fields of an outbound trunk without affecting other fields.

**LiveKit CLI**:

1. Create a file named `outbound-trunk.json` with the fields you want to update. The following example updates the name and phone numbers for the trunk:

**Twilio**:

```json
{
   "name": "My updated outbound trunk",
   "address": "<my-trunk>.pstn.twilio.com",
   "numbers": ["+15105550100"]
}

```

---

**Telnyx**:

```json
{
   "name": "My updated outbound trunk",
   "address": "sip.telnyx.com",
   "numbers": ["+15105550100"]
}

```

> ℹ️ **Note**
> 
> Use a regional SIP Signaling Address from [Telnyx SIP Signaling Addresses](https://sip.telnyx.com/#signaling-addresses) for the `address` field. This example config uses the US SIP proxy, `sip.telnyx.com`.
2. Update the outbound trunk using the CLI:

```shell
lk sip outbound update --id <sip-trunk-id> outbound-trunk.json

```

The output of the command returns the trunk ID:

```text
SIPTrunkID: <your-trunk-id>

```

---

**Node.js**:

```typescript
import { ListUpdate } from "@livekit/protocol";
import { SipClient } from 'livekit-server-sdk';

const sipClient = new SipClient(process.env.LIVEKIT_URL,
                                process.env.LIVEKIT_API_KEY,
                                process.env.LIVEKIT_API_SECRET);

/**
 * Update fields of an outbound trunk.
 * @param {string} trunkId The ID of the trunk to update.
 * @returns {Object} The result of the update operation.
 */
async function updateTrunk(trunkId) {

  const updatedTrunkFields = {
    name: 'My updated trunk',
    address: 'my-trunk.pstn.twilio.com',
    numbers: new ListUpdate({
      add: ['+15220501011'],    // Add specific numbers to the trunk
      remove: ['+15105550100'], // Remove specific numbers from the trunk
    }),
  }
  
  const trunk = await sipclient.updatesipoutboundtrunkfields (
    trunkid,
    updatedtrunkfields,
  );

  return trunk;
}

updateTrunk('<outbound-trunk-id>');

```

---

**Python**:

```python
import asyncio

from livekit import api
from livekit.protocol.models import ListUpdate


async def main():
  lkapi = api.LiveKitAPI()

  trunk = await lkapi.sip.update_sip_outbound_trunk_fields(
    trunk_id = "<sip-trunk-id>",
    name = "My updated outbound trunk",
    address = "sip.telnyx.com",
    numbers = ListUpdate(
      add=['+15225550101'],
      remove=['+15105550100'],
    ) # Add and remove specific numbers from the trunk
  )

  print(f"Successfully updated {trunk}")

  await lkapi.aclose()

asyncio.run(main())

```

---

**Ruby**:

The Ruby SDK doesn't yet support updating outbound trunks.

---

**Go**:

```go
package main

import (
  "context"
  "fmt"
  "os"

  lksdk "github.com/livekit/server-sdk-go/v2"
  "github.com/livekit/protocol/livekit"
)

func main() {
  trunkName := "My updated outbound trunk"
  numbers := &livekit.ListUpdate{Set: []string{"+16265550100"}}
  transport := livekit.SIPTransport_SIP_TRANSPORT_UDP

  trunkId := "<sip-trunk-id>"

  trunkInfo := &livekit.SIPOutboundTrunkUpdate{
    Name: &trunkName,
    Numbers: numbers,
    Transport: &transport,
  }

  // Create a request
  request := &livekit.UpdateSIPOutboundTrunkRequest{
    SipTrunkId: trunkId,
    Action: &livekit.UpdateSIPOutboundTrunkRequest_Update{
      Update: trunkInfo,
    },  
  }

  sipClient := lksdk.NewSIPClient(os.Getenv("LIVEKIT_URL"),
                                  os.Getenv("LIVEKIT_API_KEY"),
                                  os.Getenv("LIVEKIT_API_SECRET"))
  
  // Update trunk
  trunk, err := sipClient.UpdateSIPOutboundTrunk(context.Background(), request)

  if err != nil {
    fmt.Println(err)
  } else {
    fmt.Println(trunk)
  }
}
~   

```

---

**Kotlin**:

```kotlin
import io.livekit.server.SipServiceClient
import io.livekit.server.UpdateSipOutboundTrunkOptions

val sipClient = SipServiceClient.createClient(
  host = System.getenv("LIVEKIT_URL").replaceFirst(Regex("^ws"), "http"),
  apiKey = System.getenv("LIVEKIT_API_KEY"),
  secret = System.getenv("LIVEKIT_API_SECRET")
)

val response = sipClient.updateSipOutboundTrunk(
    sipTrunkId = trunkId,
    options = UpdateSipOutboundTrunkOptions(
        name = "My updated outbound trunk",
        numbers = listOf("+16265550100")
        metadata = "{'key1': 'value1', 'key2': 'value2'}",
        authUsername = "updated-username",
        authPassword = "updated-password"
    )
).execute()

if (!response.isSuccessful) {
    println(response.errorBody())
} else {
    val trunk = response.body()

    if (trunk != null) {
        println("Updated outbound trunk: ${trunk}")
    }
}

```

---

**LiveKit Cloud**:

Update and replace functions are the same in the LiveKit Cloud dashboard. For an example, see the [replace an outbound trunk](#replace-trunk) section.

### Replace an outbound trunk

The `UpdateSIPOutboundTrunk` API allows you to replace an existing outbound trunk with a new one using the same trunk ID.

**LiveKit CLI**:

The CLI doesn't support replacing outbound trunks.

---

**Node.js**:

```typescript
import { SipClient } from 'livekit-server-sdk';

const sipClient = new SipClient(process.env.LIVEKIT_URL,
                                process.env.LIVEKIT_API_KEY,
                                process.env.LIVEKIT_API_SECRET);

async function replaceTrunk(trunkId) {
  // Replace an inbound trunk entirely.
  const trunk = {
    name: "My replaced trunk",
    address: "sip.telnyx.com",
    numbers: ['+17025550100'], 
    metadata: "{\"is_internal\": true}",
    authUsername: '<updated-username>',
    authPassword: '<updated-password>',
  };

  const updatedTrunk = await sipClient.updateSipOutboundTrunk(
    trunkId,
    trunk
  );

  return updatedTrunk;
}

replaceTrunk('<outbound-trunk-id>');

```

---

**Python**:

To replace a trunk, edit the previous example by adding the following import, `trunk`, and call the `update_sip_outbound_trunk` function:

```python
from livekit.protocol.sip import SIPOutboundTrunkInfo, SIPTransport

  trunk = SIPOutboundTrunkInfo(
      address = "sip.telnyx.com",
      numbers = ['+15105550100'],
      name = "My replaced outbound trunk",
      transport = SIPTransport.SIP_TRANSPORT_AUTO,
      auth_username = "<username>",
      auth_password = "<password>",
  )

  trunk = await lkapi.sip.update_sip_outbound_trunk(
    trunkId,
    trunk
  )                     

```

---

**Ruby**:

The Ruby SDK doesn't yet support updating outbound trunks.

---

**Go**:

To replace a trunk, use the previous example with the following `trunkInfo` and `request` values:

```go
  // Create a SIPOutboundTrunkInfo object
  trunkInfo := &livekit.SIPOutboundTrunkInfo{
    Name: "My replaced outbound trunk",
    Address: "sip.telnyx.com",
    Numbers: []string{"+16265550100"},
    Transport: livekit.SIPTransport_SIP_TRANSPORT_AUTO,
    AuthUsername: "<username>",
    AuthPassword: "<password>",
  }

  // Create a request
  request := &livekit.UpdateSIPOutboundTrunkRequest{
    SipTrunkId: trunkId,
    Action: &livekit.UpdateSIPOutboundTrunkRequest_Replace{
      Replace: trunkInfo,
    },  
  }

```

---

**Kotlin**:

Replacing an outbound trunk is not supported in Kotlin.

---

**LiveKit Cloud**:

1. Sign in to the **Telephony** → [**Configuration**](https://cloud.livekit.io/projects/p_/telephony/config) page.
2. Navigate to the **Outbound** section.
3. Find the outbound trunk you want to replace → select the more (**⋮**) menu → select **Configure trunk**.
4. Copy and paste the following text into the editor:

```json
{
  "name": "My replaced trunk",
  "address": "sip.telnyx.com",
  "numbers": [
    "+17025550100"
  ],
  "metadata": "{\"is_internal\": true}",
  "authUsername": "<updated-username>",
  "authPassword": "<updated-password>"
}

```
5. Select **Update**.

## IP address range for LiveKit Cloud SIP

LiveKit Cloud nodes do not have a static IP address range, thus there's no way currently to use IP range for outbound authentication.

Thus, prefer setting user/password authentication on SIP trunk Provider.

If it's unavailable, or IP range is required in addition to user/password, set range(s) that include all IPs: e.g. `0.0.0.0/0` or `0.0.0.0/1`+`128.0.0.0/1`.

---

This document was rendered at 2025-11-26T07:07:27.739Z.
For the latest version of this document, see [https://docs.livekit.io/sip/trunk-outbound.md](https://docs.livekit.io/sip/trunk-outbound.md).

To explore all LiveKit documentation, see [llms.txt](https://docs.livekit.io/llms.txt).
---
LiveKit docs › Getting started › Telephony integration

---

# Agents telephony integration

> Enable your voice AI agent to make and receive phone calls.

## Overview

You can integrate LiveKit Agents with telephony systems using Session Initiation Protocol (SIP). You can choose to support inbound calls, outbound calls, or both. LiveKit also provides features including DTMF, SIP REFER, and more. For a full list of supported features, see the [SIP features](https://docs.livekit.io/sip.md#features).

Telephony integration requires no significant changes to your existing agent code, as phone calls are simply bridged into LiveKit rooms using a special participant type.

[Video: LiveKit Phone Numbers](https://www.youtube.com/watch?v=KJ1CgZ0iZbY)

## Getting started

1. Follow the [Voice AI quickstart](https://docs.livekit.io/agents/start/voice-ai.md) to get a simple agent up and running.
2. Set up a SIP trunk for your project or purchase a phone number through [LiveKit Phone Numbers](https://docs.livekit.io/sip/cloud/phone-numbers.md) for inbound calls.
3. Return to this guide to enable inbound and outbound calls.

- **[Voice AI quickstart](https://docs.livekit.io/agents/start/voice-ai.md)**: Follow the Voice AI quickstart to get your agent up and running.

- **[LiveKit Phone Numbers](https://docs.livekit.io/sip/cloud/phone-numbers.md)**: Purchase a phone number through LiveKit Phone Numbers for inbound calls.

- **[SIP trunk setup](https://docs.livekit.io/sip/quickstarts/configuring-sip-trunk.md)**: If you're using a SIP provider or making outbound calls, configure your provider to route calls to LiveKit.

## Agent dispatch

LiveKit recommends using explicit agent dispatch for telephony integrations to ensure no unexpected automatic dispatch occurs given the complexity of inbound and outbound calling.

To enable explicit dispatch, give your agent a name. This disables automatic dispatch.

** Filename: `agent.py`**

```python

server = AgentServer()

@server.rtc_session(agent_name="my-telephony-agent")
async def my_agent(ctx: JobContext):
    # ... your existing agent code ...

if __name__ == "__main__":
    agents.cli.run_app(server)

```

** Filename: `agent.ts`**

```typescript
// ... your existing agent code ...

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        // Agent name is required for explicit dispatch
        agent_name="my-telephony-agent"
    ))

```

> 💡 **Full examples**
> 
> See the docs on [agent dispatch](https://docs.livekit.io/agents/server/agent-dispatch.md) for more complete examples.

## Inbound calls

The fastest way to get started with inbound calling is to use [LiveKit Phone Numbers](https://docs.livekit.io/sip/cloud/phone-numbers.md). If you're using a third-party SIP provider, follow the instructions in the [SIP trunk setup](https://docs.livekit.io/sip/quickstarts/configuring-sip-trunk.md) guide to configure your SIP trunk and create an [inbound trunk](https://docs.livekit.io/sip/trunk-inbound.md).

### Dispatch rules

Create a dispatch rule to route inbound calls to your agent. The following rule routes all inbound calls to a new room and dispatches your agent to that room:

** Filename: `dispatch-rule.json`**

```json
{
    "dispatch_rule":
    {
        "rule": {
            "dispatchRuleIndividual": {
                "roomPrefix": "call-"
            }
        },
        "roomConfig": {
            "agents": [{
                "agentName": "my-telephony-agent"
            }]
        }
    }
}

```

Create this rule with the following command:

```shell
lk sip dispatch create dispatch-rule.json

```

### Answering the phone

Call the `generate_reply` method of your `AgentSession` to greet the caller after picking up. This code goes after `session.start`:

** Filename: `agent.py`**

```python
await session.generate_reply(
    instructions="Greet the user and offer your assistance."
)

```

** Filename: `agent.ts`**

```typescript
session.generateReply({
  instructions: 'Greet the user and offer your assistance.',
});


```

### Call your agent

After you start your agent with the following command, dial the number you set up earlier to hear your agent answer the phone.

** Filename: `shell`**

```shell
uv run agent.py dev

```

** Filename: `shell`**

```shell
pnpm run dev

```

## Outbound calls

Available in:
- [ ] Node.js
- [x] Python

After setting up your [outbound trunk](https://docs.livekit.io/sip/trunk-outbound.md), you may place outbound calls by dispatching an agent and then creating a SIP participant.

The following guide describes how to modify the [voice AI quickstart](https://docs.livekit.io/agents/start/voice-ai.md) for outbound calling. Alternatively, see the following complete example on GitHub:

- **[Outbound caller example](https://github.com/livekit-examples/outbound-caller-python)**: Complete example of an outbound calling agent.

### Dialing a number

Add the following code so your agent reads the phone number and places an outbound call by creating a SIP participant after connection.

You should also remove the initial greeting or place it behind an `if` statement to ensure the agent waits for the user to speak first when placing an outbound call.

> ℹ️ **SIP trunk ID**
> 
> You must fill in the `sip_trunk_id` for this example to work. You can get this from LiveKit CLI with `lk sip outbound list`.

** Filename: `agent.py`**

```python
# add these imports at the top of your file
from livekit import api
import json

# ... any existing code / imports ...

def entrypoint(ctx: agents.JobContext):
    # If a phone number was provided, then place an outbound call
    # By having a condition like this, you can use the same agent for inbound/outbound telephony as well as web/mobile/etc.
    dial_info = json.loads(ctx.job.metadata)
    phone_number = dial_info["phone_number"]

    # The participant's identity can be anything you want, but this example uses the phone number itself
    sip_participant_identity = phone_number
    if phone_number is not None:
        # The outbound call will be placed after this method is executed
        try:
            await ctx.api.sip.create_sip_participant(api.CreateSIPParticipantRequest(
                # This ensures the participant joins the correct room
                room_name=ctx.room.name,

                # This is the outbound trunk ID to use (i.e. which phone number the call will come from)
                # You can get this from LiveKit CLI with `lk sip outbound list`
                sip_trunk_id='ST_xxxx',

                # The outbound phone number to dial and identity to use
                sip_call_to=phone_number,
                participant_identity=sip_participant_identity,

                # This will wait until the call is answered before returning
                wait_until_answered=True,
            ))

            print("call picked up successfully")
        except api.TwirpError as e:
            print(f"error creating SIP participant: {e.message}, "
                  f"SIP status: {e.metadata.get('sip_status_code')} "
                  f"{e.metadata.get('sip_status')}")
            ctx.shutdown()
    
    # .. create and start your AgentSession as normal ...

    # Add this guard to ensure the agent only speaks first in an inbound scenario.
    # When placing an outbound call, its more customary for the recipient to speak first
    # The agent will automatically respond after the user's turn has ended.
    if phone_number is None:
        await session.generate_reply(
            instructions="Greet the user and offer your assistance."
        )

```

** Filename: `agent.ts`**

```typescript
import { SipClient } from 'livekit-server-sdk';
// ... any existing code / imports ...


// Set the outbound trunk ID and room name
const outboundTrunkId = '<outbound-trunk-id>';
const sipRoom = 'new-room';


entry: async (ctx: JobContext) => {
    // If a phone number was provided, then place an outbound call
    // By having a condition like this, you can use the same agent for inbound/outbound telephony as well as web/mobile/etc.
    const dialInfo = JSON.parse(ctx.job.metadata);

    const phoneNumber = dialInfo["phone_number"];

    // The participant's identity can be anything you want, but this example uses the phone number itself
    const sipParticipantIdentity = phoneNumber;
    if (phoneNumber) {
        const sipParticipantOptions = {
            participantIdentity: sipParticipantIdentity,
            participantName: 'Test callee',
            waitUntilAnswered: true,
        };
        const sipClient = new SipClient(process.env.LIVEKIT_URL!,
                                        process.env.LIVEKIT_API_KEY!,
                                        process.env.LIVEKIT_API_SECRET!);

        try {
            const participant = await sipClient.createSipParticipant(
                outboundTrunkId,
                phoneNumber,
                sipRoom,
                sipParticipantOptions
            );  

            console.log('Participant created:', participant);
        } catch (error) {
            console.error('Error creating SIP participant:', error);
        }
    }

    // .. create and start your AgentSession as usual ...

    // Add this guard to ensure the agent only speaks first in an inbound scenario.
    // When placing an outbound call, its more customary for the recipient to speak first
    // The agent will automatically respond after the user's turn has ended.
    if (!phoneNumber) {
        session.generateReply({
            instructions: 'Greet the user and offer your assistance.',
        });
    }
}

```

Start the agent and follow the instructions in the next section to call your agent.

#### Make a call with your agent

Use either the LiveKit CLI or the Python API to instruct your agent to place an outbound phone call.

In this example, the job's metadata includes the phone number to call. You can extend this to include more information if needed for your use case.

The agent name must match the name you assigned to your agent. If you set it earlier in the [agent dispatch](#agent-dispatch) section, this is `my-telephony-agent`.

> ❗ **Room name must match for Node.js**
> 
> For Node.js, the room name must match the name you use for the `CreateSIPParticipant` API call. If you use the sample code from the [Dialing a number](#dialing) section, this is `new-room`. Otherwise, the agent dials the number, but doesn't join the correct room.

**LiveKit CLI**:

The following command creates a new room and dispatches your agent to it with the phone number to call.

```shell
lk dispatch create \
    --new-room \
    --agent-name my-telephony-agent \
    --metadata '{"phone_number": "+15105550123"}' # insert your own phone number here

```

---

**Python**:

```python
await lkapi.agent_dispatch.create_dispatch(
    api.CreateAgentDispatchRequest(
        # Use the agent name you set in the realtime_session decorator
        agent_name="my-telephony-agent", 

        # The room name to use. This should be unique for each call
        room=f"outbound-{''.join(str(random.randint(0, 9)) for _ in range(10))}",

        # Here we use JSON to pass the phone number, and could add more information if needed.
        metadata='{"phone_number": "+15105550123"}'
    )
)

```

### Voicemail detection

Your agent may still encounter an automated system such as an answering machine or voicemail. You can give your LLM the ability to detect a likely voicemail system via tool call, and then perform special actions such as leaving a message and [hanging up](#hangup).

** Filename: `agent.py`**

```python
import asyncio # add this import at the top of your file

class Assistant(Agent):
    ## ... existing init code ...
        
    @function_tool
    async def detected_answering_machine(self):
        """Call this tool if you have detected a voicemail system, AFTER hearing the voicemail greeting"""
        await self.session.generate_reply(
            instructions="Leave a voicemail message letting the user know you'll call back later."
        )
        await asyncio.sleep(0.5) # Add a natural gap to the end of the voicemail message
        await hangup_call()

```

** Filename: `agent.ts`**

```typescript
class VoicemailAgent extends voice.Agent {
  constructor() {
      super({
          // ... existing init code ...
          tools: {
              leaveVoicemail: llm.tool({
                  description: 'Call this tool if you detect a voicemail system, AFTER your hear the voicemail greeting',
                  execute: async (_, { ctx }: llm.ToolOptions) => {
                      const handle = ctx.session.generateReply({
                          instructions:
                              "Leave a brief voicemail message for the user telling them you are sorry you missed them, but you will call back later. You don't need to mention you're going to leave a voicemail, just say the message.",
                      });
                  
                      handle.waitForPlayout().then(async () => {
                  
                          await new Promise((resolve) => setTimeout(resolve, 500));
                  
                          // See the Hangup section for more details
                          await hangUpCall();
                      });
                  }
              }),
          }
      })
  }
}

```

## Hangup

To end a call for all participants, use the `delete_room` API. If only the agent session ends, the user will continue to hear silence until they hang up. The example below shows a basic `hangup_call` function you can use as a starting point.

** Filename: `agent.py`**

```python
# Add these imports at the top of your file
from livekit import api, rtc
from livekit.agents import get_job_context

# Add this function definition anywhere
async def hangup_call():
    ctx = get_job_context()
    if ctx is None:
        # Not running in a job context
        return
    
    await ctx.api.room.delete_room(
        api.DeleteRoomRequest(
            room=ctx.room.name,
        )
    )

class MyAgent(Agent):
    ...

    # to hang up the call as part of a function call
    @function_tool
    async def end_call(self, ctx: RunContext):
        """Called when the user wants to end the call"""
        await ctx.wait_for_playout() # let the agent finish speaking

        await hangup_call()

```

** Filename: `agent.ts`**

```typescript
import { RoomServiceClient } from 'livekit-server-sdk';
import { getJobContext } from '@livekit/agents';

const hangUpCall = async () => {
  const jobContext = getJobContext();
  if (!jobContext) {
    return;
  }

  const roomServiceClient = new RoomServiceClient(process.env.LIVEKIT_URL!,
                                                  process.env.LIVEKIT_API_KEY!,
                                                  process.env.LIVEKIT_API_SECRET!);

  if (jobContext.room.name) {
    await roomServiceClient.deleteRoom(
      jobContext.room.name,
    );
  }
}

class MyAgent extends voice.Agent {
  constructor() {
    super({
        instructions: 'You are a helpful voice AI assistant.',
        // ... existing code ...
        tools: {
          hangUpCall: llm.tool({
            description: 'Call this tool if the user wants to hang up the call.',
            execute: async (_, { ctx }: llm.ToolOptions<UserData>) => {
              await hangUpCall();
              return "Hung up the call";
            },
          }),
        },
    });
 }
}

```

## Transferring call to another number

In case the agent needs to transfer the call to another number or SIP destination, you can use the [`TranserSIPParticipant`](https://docs.livekit.io/sip/api.md#transfersipparticipant) API.

This is a [cold transfer](https://docs.livekit.io/sip/transfer-cold.md), where the agent hands the call off to another party without staying on the line. The current session ends after the transfer is complete.

> ℹ️ **Node.js required package**
> 
> To use the Node.js example, you must install the `@livekit/rtc-node` package:
> 
> ```shell
> pnpm add @livekit/rtc-node
> 
> ```

** Filename: `agent.py`**

```python
class Assistant(Agent):
    ## ... existing init code ...

    @function_tool()
    async def transfer_call(self, ctx: RunContext):
        """Transfer the call to a human agent, called after confirming with the user"""

        transfer_to = "+15105550123"
        participant_identity = "+15105550123"

        # let the message play fully before transferring
        await ctx.session.generate_reply(
            instructions="Inform the user that you're transferring them to a different agent."
        )

        job_ctx = get_job_context()
        try:
            await job_ctx.api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=job_ctx.room.name,
                    participant_identity=participant_identity,
                    # to use a sip destination, use `sip:user@host` format
                    transfer_to=f"tel:{transfer_to}",
                )
            )
        except Exception as e:
            print(f"error transferring call: {e}")
            # give the LLM that context
            return "could not transfer call"

```

** Filename: `agent.ts`**

```typescript
// Add these imports at the top of your file
import { SipClient } from 'livekit-server-sdk';
import { RemoteParticipant } from '@livekit/rtc-node';

// Add this function definition
async function transferParticipant(participant: RemoteParticipant, roomName: string) {
  console.log("transfer participant initiated for participant: ", participant.identity);

  const sipTransferOptions = {
    playDialtone: false
  };

  const sipClient = new SipClient(process.env.LIVEKIT_URL!,
                                  process.env.LIVEKIT_API_KEY!,
                                  process.env.LIVEKIT_API_SECRET!);

  const transferTo = "tel:+15105550123";

  await sipClient.transferSipParticipant(roomName, participant.identity, transferTo, sipTransferOptions);
  console.log('transferred participant');
}

```

> ℹ️ **SIP REFER**
> 
> You must enable SIP REFER on your SIP trunk provider to use `transfer_sip_participant`. For Twilio, you must also enable `Enable PSTN Transfer`. To learn more, see [Cold transfer](https://docs.livekit.io/sip/transfer-cold.md).

## Recipes

The following recipes are particular helpful to learn more about telephony integration.

- **[Company Directory](https://docs.livekit.io/recipes/company-directory.md)**: Build a AI company directory agent. The agent can respond to DTMF tones and voice prompts, then redirect callers.

- **[SIP Lifecycle](https://github.com/livekit-examples/python-agents-examples/tree/main/telephony/sip_lifecycle.py)**: Complete lifecycle management for SIP calls.

- **[Survey Caller](https://github.com/livekit-examples/python-agents-examples/tree/main/telephony/survey_caller/)**: Automated survey calling system.

## Additional resources

The following guides provide more information on building voice agents for telephony.

- **[Workflows](https://docs.livekit.io/agents/build/workflows.md)**: Orchestrate detailed workflows such as collecting credit card information over the phone.

- **[Handling DTMF](https://docs.livekit.io/sip/dtmf.md)**: Sending and receiving DTMF in LiveKit telephony apps.

- **[Tool definition & use](https://docs.livekit.io/agents/build/tools.md)**: Extend your agent's capabilities with tools.

- **[Telephony documentation](https://docs.livekit.io/sip.md)**: Full documentation on the LiveKit SIP integration and features.

- **[Agent speech](https://docs.livekit.io/agents/build/audio.md)**: Customize and perfect your agent's verbal interactions.

---

This document was rendered at 2025-11-26T07:08:06.142Z.
For the latest version of this document, see [https://docs.livekit.io/agents/start/telephony.md](https://docs.livekit.io/agents/start/telephony.md).

To explore all LiveKit documentation, see [llms.txt](https://docs.livekit.io/llms.txt).