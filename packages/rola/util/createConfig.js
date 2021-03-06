const path = require('path')
const node = require('@rola/preset-node')

const cwd = process.cwd()

module.exports = function createConfig ({ entry, watch, env, alias, banner, presets }) {
  const isNode = /server/.test(entry)

  return {
    in: entry,
    out: isNode ? {
      path: path.join(cwd, 'build'),
      libraryTarget: 'commonjs2'
    } : path.join(cwd, 'build/assets'),
    env: env || {},
    alias: alias || {},
    presets: [].concat(presets || []).concat([
      isNode && node()
    ].filter(Boolean)),
    banner: isNode ? (
      `require('source-map-support').install();`
    ) : (
      '/** built with rola */'
    ) + banner || ''
  }
}
