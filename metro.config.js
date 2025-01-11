const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultAssetExts = require('metro-config/src/defaults/defaults').assetExts

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    resolver: {
        assetExts: [
          ...defaultAssetExts,
          'bin', // ggml model binary
          'mil', // CoreML model asset
        ],
      },
      transformer: {
        getTransformOptions: async () => ({
          transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
          },
        }),
      },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
