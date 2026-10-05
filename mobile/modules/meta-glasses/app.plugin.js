const { createRequire } = require('module')
const requireFromExpo = createRequire(require.resolve('expo/package.json'))
const { withInfoPlist, withAndroidManifest } = requireFromExpo('@expo/config-plugins')

/**
 * Writes Wearables Developer Center identifiers only when linkDatSdk is set.
 * ExternalAccessory is intentionally omitted: the DAT SDK's use of it is what
 * currently gets an App Store binary rejected under Apple's MFi rules.
 */
function withMetaGlasses(config) {
  const extra = config.extra?.metaGlasses ?? {}
  if (!extra.linkDatSdk) return config

  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      config.modResults.NSBluetoothAlwaysUsageDescription ||
      'Vantage uses Bluetooth to show a visit glance card on Meta Ray-Ban Display glasses.'
    if (extra.metaAppId) config.modResults.MetaAppID = String(extra.metaAppId)
    if (extra.clientToken) config.modResults.ClientToken = String(extra.clientToken)
    if (extra.teamId) config.modResults.TeamID = String(extra.teamId)
    config.modResults.AppLinkURLScheme = String(extra.urlScheme || 'vantagecrm')
    const modes = new Set(config.modResults.UIBackgroundModes || [])
    modes.add('bluetooth-central')
    config.modResults.UIBackgroundModes = Array.from(modes)
    return config
  })

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const permissions = manifest['uses-permission'] ?? []
    const names = new Set(permissions.map((item) => item.$?.['android:name']).filter(Boolean))
    for (const name of [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
    ]) {
      if (!names.has(name)) {
        permissions.push({ $: { 'android:name': name } })
      }
    }
    manifest['uses-permission'] = permissions
    return config
  })

  return config
}

module.exports = withMetaGlasses
