package expo.modules.metaglasses

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MetaGlassesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MetaGlasses")

    Function("status") {
      GlassesNativeSession.status()
    }

    Function("startSession") { cards: List<Map<String, Any?>> ->
      GlassesNativeSession.start(cards)
    }

    Function("sendFrame") { frame: Map<String, Any?> ->
      GlassesNativeSession.send(frame)
    }

    Function("stopSession") {
      GlassesNativeSession.stop()
    }
  }
}

/**
 * Phone preview. The Wearables DAT Kotlin artifacts are not linked, so this
 * module stores the latest full frame and reports transport "phone-preview".
 */
object GlassesNativeSession {
  private var state: String = "stopped"
  private var frame: Map<String, Any?>? = null

  fun status(): Map<String, Any?> {
    return mapOf(
      "state" to state,
      "transport" to "phone-preview",
      "frame" to frame,
    )
  }

  fun start(cards: List<Map<String, Any?>>): Map<String, Any?> {
    state = "started"
    frame = cards.firstOrNull()
    return status()
  }

  fun send(next: Map<String, Any?>): Map<String, Any?> {
    state = "started"
    frame = next
    return status()
  }

  fun stop(): Map<String, Any?> {
    state = "stopped"
    frame = null
    return status()
  }
}
