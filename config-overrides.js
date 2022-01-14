module.exports = (config, env) => {
  // console.log(config.module.rules[1]);
  config.module.rules[1].oneOf.unshift({
    test: /\.wasm$/,
    type: 'javascript/auto',
    loader: 'file-loader',
  });
  return config;
};
