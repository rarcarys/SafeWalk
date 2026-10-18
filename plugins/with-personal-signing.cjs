const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = config => {
  if (process.env.SAFEWALK_UNSIGNED_IOS !== '1') return config;
  return withEntitlementsPlist(config, result => {
    // Personal Apple accounts cannot provision the remote push entitlement.
    // Chat SOS and local notifications do not require it.
    delete result.modResults['aps-environment'];
    return result;
  });
};
