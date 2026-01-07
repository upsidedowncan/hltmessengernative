module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
        // NOTE: this is optional, you don't *need* the compiler
        [
            'transform-inline-environment-variables',
            {
                include: ['EXPO_ROUTER_APP_ROOT'],
            },
        ],
        'react-native-reanimated/plugin',
    ],
  };
};