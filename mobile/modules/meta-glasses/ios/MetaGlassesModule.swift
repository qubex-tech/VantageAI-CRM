import ExpoModulesCore

public class MetaGlassesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MetaGlasses")

    Function("status") { () -> [String: Any] in
      GlassesNativeSession.status()
    }

    Function("startSession") { (cards: [[String: Any]]) -> [String: Any] in
      GlassesNativeSession.start(cards: cards)
    }

    Function("sendFrame") { (frame: [String: Any]) -> [String: Any] in
      GlassesNativeSession.send(frame: frame)
    }

    Function("stopSession") { () -> [String: Any] in
      GlassesNativeSession.stop()
    }
  }
}

/// Phone preview until MWDATCore is linked. The phone remains the source of truth.
enum GlassesNativeSession {
  private static var state = "stopped"
  private static var frame: [String: Any]?

  static func status() -> [String: Any] {
    var payload: [String: Any] = [
      "state": state,
      "transport": transport(),
    ]
    if let frame {
      payload["frame"] = frame
    }
    return payload
  }

  static func start(cards: [[String: Any]]) -> [String: Any] {
    state = "started"
    frame = cards.first
    #if canImport(MWDATCore) && canImport(MWDATDisplay)
    DatDisplayBridge.start(cards: cards)
    #endif
    return status()
  }

  static func send(frame next: [String: Any]) -> [String: Any] {
    state = "started"
    frame = next
    #if canImport(MWDATCore) && canImport(MWDATDisplay)
    DatDisplayBridge.send(frame: next)
    #endif
    return status()
  }

  static func stop() -> [String: Any] {
    state = "stopped"
    frame = nil
    #if canImport(MWDATCore) && canImport(MWDATDisplay)
    DatDisplayBridge.stop()
    #endif
    return status()
  }

  private static func transport() -> String {
    #if canImport(MWDATCore) && canImport(MWDATDisplay)
    return "dat"
    #else
    return "phone-preview"
    #endif
  }
}

#if canImport(MWDATCore) && canImport(MWDATDisplay)
import MWDATCore
import MWDATDisplay

enum DatDisplayBridge {
  private static var session: DeviceSession?
  private static var display: Display?

  static func start(cards: [[String: Any]]) {
    if session == nil {
      try? Wearables.configure()
      session = try? Wearables.shared.createSession()
      try? session?.start()
      display = try? session?.addDisplay()
      display?.start()
    }
    if let first = cards.first {
      send(frame: first)
    }
  }

  static func send(frame: [String: Any]) {
    let title = frame["title"] as? String ?? ""
    let lines = frame["lines"] as? [String] ?? []
    let view = FlexBox(direction: .column, spacing: 12) {
      Text(title, style: .heading)
      Text(lines.joined(separator: "\n"), style: .body)
    }
    Task {
      try? await display?.send(view)
    }
  }

  static func stop() {
    display?.stop()
    session?.stop()
    display = nil
    session = nil
  }
}
#endif
