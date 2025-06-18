import { assert, Colors, Coords, Events, Random, TextAlignment, Vector, clamp, text } from "@vaguevoid/fiasco"
import type {
  Aspect,
  Camera,
  EntityId,
  EventReader,
  EventWriter,
  FrameConstants,
  GpuInterface,
  Inputs,
  LocalToWorld,
  Query,
  SystemOnce,
  TextRender,
  Transform,
} from "@vaguevoid/fiasco"
import { Game } from "@vaguevoid/fiasco/game"
import { Components } from "../.fiasco/generated"
import MeteorTexture from "./assets/meteor.png"
import ShipTexture from "./assets/ship_E.png"
import type { Cannon, DestroyedLabel, EntityCountLabel, FPSLabel, Meteor, Ship } from "./components"
import { Destroyed } from "./resources"

import Code = Events.Input.KeyCode

const RAND = new Random()

const CANNON_SPEED = 1000
const CANNON_SCALE = 4
const CANNON_Z = 0

const SHIP_TURN_SPEED = 3
const SHIP_SCALE = 50
const SHIP_ACCELERATION = 10
const SHIP_DECELERATION = 3
const SHIP_Z = 1

const METEOR_COUNT = 30
const METEOR_SCALE = 50
const METEOR_Z = 2

// The spawner system spawns entities at startup
function spawner(
  aspect: Aspect,
  gpuInterface: GpuInterface,
  newTextureWriter: EventWriter<Events.Graphics.NewTexture>,
): SystemOnce {
  console.log("%ox%o", aspect.height, aspect.width)

  const shipPendingTexture = gpuInterface.textureAssetManager.loadTexture(newTextureWriter, ShipTexture)
  assert(shipPendingTexture, `Texture failed to load: ${ShipTexture}`)

  const meteorPendingTexture = gpuInterface.textureAssetManager.loadTexture(newTextureWriter, MeteorTexture)
  assert(meteorPendingTexture, `Texture failed to load: ${MeteorTexture}`)

  // Spawn player controlled Ship
  engine.spawn([
    new Components.Transform({
      position: { x: 0, y: 0, z: SHIP_Z },
      scale: { x: SHIP_SCALE, y: SHIP_SCALE },
    }),
    new Components.TextureRender({ textureId: shipPendingTexture.id }),
    new Components.Ship({ velocity: { x: 0, y: 0 } }),
  ])

  // Spawn a camera to follow the ship
  const cameraId = engine.spawn([new Components.Camera(), new Components.Transform()])

  // Spawn meteors
  for (let i = 0; i < METEOR_COUNT; i++) {
    const scale = RAND.number(METEOR_SCALE - 10, METEOR_SCALE + 10)
    const x = RAND.number(aspect.left, aspect.right)
    const y = RAND.number(aspect.bottom, aspect.top)
    engine.spawn([
      new Components.BoxCollider(),
      new Components.Meteor(),
      new Components.Transform({
        position: { x, y, z: METEOR_Z },
        scale: { x: scale, y: scale },
        rotation: RAND.number(0, Math.PI),
      }),
      new Components.TextureRender({ textureId: meteorPendingTexture.id }),
      new Components.Color(Colors.hsv(RAND.number(220, 320), RAND.number(0.5, 0.8), RAND.number(0.8, 1), 0.9)),
    ])
  }

  // Spawn Destroyed Label
  engine.spawn([
    new Components.DestroyedLabel(),
    new Components.Transform(),
    new Components.Color(Colors.Palette.WHITE_SMOKE),
    new Components.TextRender({
      text: text(""),
      bounds: { x: 1000, y: 1000 },
    }),
  ])

  // Spawn FPS Label
  const fpsLabelId = engine.spawn([
    new Components.FPSLabel(),
    new Components.Transform(),
    new Components.Color(Colors.Palette.YELLOW),
    new Components.TextRender({
      text: text(""),
      alignment: TextAlignment.Right,
      bounds: { x: 1000, y: 1000 },
    }),
  ])

  engine.setParent(fpsLabelId, cameraId, true)

  // Entity Cannon Count Label
  const countLabelId = engine.spawn([
    new Components.EntityCountLabel(),
    new Components.Transform(),
    new Components.Color(Colors.Palette.YELLOW),
    new Components.TextRender({
      text: text(""),
      bounds: { x: 1000, y: 1000 },
    }),
  ])
  engine.setParent(countLabelId, cameraId, true)
}

// This is just an example of an event reader, has no impact on the actual game
function keylogger(keyInputs: EventReader<Events.Input.KeyboardInput>) {
  for (const keyInput of keyInputs) {
    console.log("Key was pushed:", Events.Input.KeyCode[keyInput.keyCode()])
  }
}

// Moves every cannon ball entity towards it's rotation every frame
function cannonMover(cannons: Query<[Transform, EntityId, Cannon]>, consts: FrameConstants) {
  for (const [cannon, entity] of cannons) {
    cannon.position.x += Math.cos(cannon.rotation) * consts.delta * CANNON_SPEED
    cannon.position.y += Math.sin(cannon.rotation) * consts.delta * CANNON_SPEED

    // If cannon far away, despawn it
    if (Math.abs(cannon.position.x) > 2000 || Math.abs(cannon.position.y) > 2000) {
      engine.despawn(entity.id)
    }
  }
}

// Spins every meteor entity every frame
function meteorSpinner(meteors: Query<[Transform, Meteor]>, consts: FrameConstants) {
  for (const [meteor] of meteors) {
    meteor.rotation += consts.delta
  }
}

function collisionHandler(collisions: EventReader<Events.Physics.BoxCollision>, destroyed: Destroyed) {
  for (const collision of collisions) {
    engine.despawn(collision.entities(0)!)
    engine.despawn(collision.entities(1)!)
    destroyed.meteors++
  }
}

// Handles user input with WASD to move the ships, and SPACE to shoot cannon
function controller(inputs: Inputs, consts: FrameConstants, ships: Query<[Transform, Ship]>) {
  const up = inputs.key(Code.KeyW).isHeld || inputs.key(Code.ArrowUp).isHeld
  const right = inputs.key(Code.KeyD).isHeld || inputs.key(Code.ArrowRight).isHeld
  const left = inputs.key(Code.KeyA).isHeld || inputs.key(Code.ArrowLeft).isHeld

  for (const [transform, ship] of ships) {
    if (left) {
      transform.rotation += consts.delta * SHIP_TURN_SPEED
    }

    if (right) {
      transform.rotation -= consts.delta * SHIP_TURN_SPEED
    }

    const forwardX = Math.cos(transform.rotation)
    const forwardY = Math.sin(transform.rotation)

    if (up) {
      ship.velocity = {
        x: clamp(ship.velocity.x + forwardY * consts.delta * -SHIP_ACCELERATION, -5, 5),
        y: clamp(ship.velocity.y - forwardX * consts.delta * -SHIP_ACCELERATION, -5, 5),
      }
    } else {
      ship.velocity = Vector.lerp(ship.velocity, { x: 0, y: 0 }, consts.delta * SHIP_DECELERATION)
    }

    transform.position.x += ship.velocity.x
    transform.position.y += ship.velocity.y

    if (inputs.mouse.left.isHeld || inputs.key(Code.Space).isHeld) {
      // Spawn a cannon
      engine.spawn([
        new Components.BoxCollider(),
        new Components.Cannon(),
        new Components.Transform({
          position: { x: transform.position.x, y: transform.position.y, z: CANNON_Z },
          scale: { x: CANNON_SCALE, y: CANNON_SCALE },
          rotation: transform.rotation + Math.PI / 2 + RAND.number(-0.1, 0.1),
        }),
        new Components.CircleRender(),
        new Components.Color(Colors.Palette.ORANGE_RED),
      ])
    }
  }
}

function cameraMover(cameras: Query<[Transform, Camera]>, ships: Query<[Transform, Ship]>) {
  for (const [camTransform, camera] of cameras.take(1)) {
    if (camera.isEnabled) {
      for (const [shipTransform] of ships) {
        camTransform.position = shipTransform.position
      }
    }
  }
}

// Update the "Destroyed" label text
function destroyedLabelUpdater(
  labels: Query<[TextRender, Transform, DestroyedLabel]>,
  cameras: Query<[LocalToWorld, Camera]>,
  destroyed: Destroyed,
  aspect: Aspect,
) {
  for (const [textRender, labelTransform] of labels.take(1)) {
    textRender.text = text(`Destroyed: ${destroyed.meteors}`)

    for (const [localToWorld, camera] of cameras) {
      if (camera.isEnabled) {
        const screenPosition = { x: aspect.left / camera.orthographicSize, y: aspect.bottom / camera.orthographicSize }
        const world = Coords.localToWorld(screenPosition, localToWorld.matrix)

        labelTransform.position.x = world.x + 10
        labelTransform.position.y = world.y + 20
      }
    }
  }
}

function fpsLabelUpdater(
  labels: Query<[TextRender, Transform, FPSLabel]>,
  cameras: Query<[Camera]>,
  aspect: Aspect,
  consts: FrameConstants,
) {
  for (const [textRender, transform] of labels.take(1)) {
    textRender.text = text(`FPS: ${consts.frameRate.toFixed(2)}`)

    for (const [camera] of cameras) {
      if (camera.isEnabled) {
        transform.position.x = aspect.right / camera.orthographicSize
        transform.position.y = (aspect.top - 20) / camera.orthographicSize
      }
    }
  }
}

function entityCountLabelUpdater(
  labels: Query<[TextRender, Transform, EntityCountLabel]>,
  cannons: Query<[Cannon]>,
  cameras: Query<[Camera]>,
  aspect: Aspect,
) {
  for (const [textRender, transform] of labels.take(1)) {
    textRender.text = text(`Count: ${cannons.length()}`)
    for (const [camera] of cameras) {
      if (camera.isEnabled) {
        transform.position.x = aspect.left / camera.orthographicSize
        transform.position.y = (aspect.top - 20) / camera.orthographicSize
      }
    }
  }
}

export const systems = [
  spawner,
  destroyedLabelUpdater,
  fpsLabelUpdater,
  entityCountLabelUpdater,
  controller,
  keylogger,
  cannonMover,
  meteorSpinner,
  collisionHandler,
  cameraMover,
]

export const resources = [new Destroyed()]

export default new Game({ name: "AsteroidHunter", systems, resources })
