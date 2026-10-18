import AppIntents
internal import ExpoModulesCore
import Foundation

// This file is compiled into the app target so Xcode can discover its App Intent.
private enum SOSRequestStore {
  static let lock = NSLock()
  static let ownerKey = "safewalk.actionSOS.owner"
  static let pendingKey = "safewalk.actionSOS.pending"
  static let lastKey = "safewalk.actionSOS.lastRequestAt"

  static func setOwner(_ owner: String?) {
    lock.lock()
    defer { lock.unlock() }
    let defaults = UserDefaults.standard
    if defaults.string(forKey: ownerKey) != owner {
      defaults.removeObject(forKey: pendingKey)
      defaults.removeObject(forKey: lastKey)
    }
    defaults.set(owner, forKey: ownerKey)
  }

  static func enqueue() throws {
    lock.lock()
    defer { lock.unlock() }
    let defaults = UserDefaults.standard
    guard let owner = defaults.string(forKey: ownerKey), !owner.isEmpty else {
      throw SOSShortcutError.signInRequired
    }
    let now = Date().timeIntervalSince1970 * 1000
    if let pending = defaults.dictionary(forKey: pendingKey),
       let createdAt = pending["createdAt"] as? Double,
       pending["ownerId"] as? String == owner,
       now - createdAt >= 0, now - createdAt < 120_000 {
      return
    }
    if now - defaults.double(forKey: lastKey) < 5_000 { return }
    defaults.set([
      "id": "action_" + UUID().uuidString,
      "ownerId": owner,
      "createdAt": now
    ], forKey: pendingKey)
    defaults.set(now, forKey: lastKey)
  }

  static func pending() -> [String: Any]? {
    lock.lock()
    defer { lock.unlock() }
    return UserDefaults.standard.dictionary(forKey: pendingKey)
  }

  static func acknowledge(_ id: String) {
    lock.lock()
    defer { lock.unlock() }
    if UserDefaults.standard.dictionary(forKey: pendingKey)?["id"] as? String == id {
      UserDefaults.standard.removeObject(forKey: pendingKey)
    }
  }
}

private enum SOSShortcutError: LocalizedError {
  case signInRequired

  var errorDescription: String? {
    "Откройте SafeWalk и войдите в аккаунт перед использованием команды SOS."
  }
}

final class SafeWalkSOS: Module {
  func definition() -> ModuleDefinition {
    Name("SafeWalkSOS")

    Function("setOwner") { (owner: String?) in
      SOSRequestStore.setOwner(owner)
    }
    Function("pendingRequest") {
      SOSRequestStore.pending()
    }
    Function("acknowledge") { (id: String) in
      SOSRequestStore.acknowledge(id)
    }
  }
}

@available(iOS 16.0, *)
struct SendSafeWalkSOSIntent: AppIntent {
  static var title: LocalizedStringResource = "Отправить SOS"
  static var description = IntentDescription(
    "Открывает SafeWalk и отправляет SOS выбранным контактам в чатах приложения без геопозиции. При отсутствии сети SOS ожидает отправки."
  )
  static var openAppWhenRun: Bool = true
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  func perform() async throws -> some IntentResult {
    try SOSRequestStore.enqueue()
    // Sending is acknowledged by the app, never by merely running this intent.
    return .result()
  }
}

@available(iOS 16.0, *)
struct SafeWalkSOSShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: SendSafeWalkSOSIntent(),
      phrases: ["Отправить SOS через \(.applicationName)"],
      shortTitle: "Отправить SOS",
      systemImageName: "exclamationmark.triangle.fill"
    )
  }
}
