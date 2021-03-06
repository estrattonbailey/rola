#! /usr/bin/env node
'use strict'

let log = null

const fs = require('fs-extra')
const path = require('path')
const exit = require('exit')
const onExit = require('exit-hook')
const React = require('react')

const rolaCompiler = require('@rola/compiler')
const rolaStatic = require('@rola/static')
const { getConfig, createDocument } = require('@rola/util')

const createServer = require('./util/createServer.js')
const createConfig = require('./util/createConfig.js')

const cwd = process.cwd()

const pkg = require('./package.json')
const userPkg = require(path.join(cwd, './package.json'))

const PORT = process.env.PORT || 3000
const prog = require('commander')
  .version(pkg.version)

process.env.ROLA_VERSION = pkg.version

let clientEntry
let serverEntry

try {
  clientEntry = require.resolve(path.join(cwd, 'client.js'))
} catch (e) {}

try {
  serverEntry = require.resolve(path.join(cwd, 'server.js'))
} catch (e) {}

/**
 * clean up outdir
 */
fs.removeSync(path.join(cwd, 'build'))

/**
 * remove temp dir on exit
 */
onExit(() => {
  fs.removeSync(path.join(cwd, '.rola'))
})

let server

function serve () {
  if (!server) {
    server = createServer({
      file: path.join(cwd, '/build/server.js'),
      port: PORT
    })

    server.init()

    log({ server: [ PORT ] })

    onExit(() => {
      server && server.close()
    })
  }
}

function createGenerator (config, plugins) {
  const generator = rolaStatic({
    env: config.env,
    alias: config.alias,
    presets: config.presets,
    plugins
  })

  generator.on('rendered', pages => {
    log({ static: pages })
    // TODO clear logs?
    server && server.update()
  })
  generator.on('warn', e => {
    log(state => ({
      warn: state.warn.concat(e)
    }))
  })
  generator.on('error', e => {
    log(state => ({
      error: state.error.concat(e)
    }))
  })

  return generator
}

function createServerProps ({ presets }) {
  const context = {
    name: userPkg.name,
    version: userPkg.version
  }

  const tags = createDocument({
    context,
    plugins: presets
  })

  const props = {
    context,
    tags
  }

  fs.outputFileSync(
    path.join(cwd, '.rola', 'props.js'),
    `module.exports = ${JSON.stringify(props, null, '  ')}`
  )
}

prog
  .command('build')
  .action(async () => {
    log({ actions: [ 'build' ] })

    const { plugins, ...config } = getConfig()

    for (let key in (config.env || {})) {
      process.env[key] = config.env[key]
    }

    const configs = []

    if (clientEntry) configs.push(createConfig({
      entry: clientEntry,
      env: config.env,
      alias: config.alias,
      presets: config.presets
    }))

    if (serverEntry) configs.push(createConfig({
      entry: serverEntry,
      env: config.env,
      alias: config.alias,
      presets: config.presets
    }))

    createServerProps({
      presets: [
        ...config.presets,
        (clientEntry ? {
          createDocument ({ context }) {
            return {
              body: `<script src='/client.js?v${context.version}'></script>`
            }
          }
        } : {})
      ]
    })

    async function done () {
      /**
       * for api requests, if needed
       */
      if (serverEntry) serve()

      await createGenerator(config, plugins).render('/static', '/build/assets')

      exit()
    }

    if (configs.length) {
      let allstats = []
      const compiler = rolaCompiler(configs)

      compiler.on('error', e => {
        log(state => ({
          error: state.error.concat(e)
        }))
      })

      compiler.on('warn', e => {
        log(state => ({
          warn: state.warn.concat(e)
        }))
      })

      compiler.on('stats', async stats => {
        stats.map(_stats => {
          const server = _stats.assets.reduce((bool, asset) => {
            if (/server/.test(asset.name)) bool = true
            return bool
          }, false)

          if (server) {
            allstats[1] = _stats
          } else {
            allstats[0] = _stats
          }
        })

        log({
          actions: [],
          stats: allstats
        })

        done()
      })

      compiler.build()
    } else {
      done()
    }
  })

prog
  .command('watch')
  .action(async () => {
    log({ actions: [ 'watch' ] })

    const { plugins, ...config } = getConfig()

    for (let key in (config.env || {})) {
      process.env[key] = config.env[key]
    }

    let compiled = false
    const configs = []

    if (clientEntry) configs.push(createConfig({
      entry: clientEntry,
      env: config.env,
      alias: config.alias,
      banner: require('./util/clientReloader.js')(PORT),
      presets: config.presets
    }))

    if (serverEntry) configs.push(createConfig({
      entry: serverEntry,
      env: config.env,
      alias: config.alias,
      presets: config.presets
    }))

    let allstats = []

    createServerProps({
      presets: [
        ...config.presets,
        (clientEntry ? {
          createDocument ({ context }) {
            return {
              body: `<script src='/client.js?v${context.version}'></script>`
            }
          }
        } : {})
      ]
    })

    if (configs.length) {
      const compiler = rolaCompiler(configs)

      compiler.on('error', e => {
        log(state => ({
          error: state.error.concat(e)
        }))
      })

      compiler.on('warn', e => {
        log(state => ({
          warn: state.warn.concat(e)
        }))
      })

      compiler.on('stats', stats => {
        // TODO
        // use the errors/warnings on stats objects
        // to keep track on pertinent warnings
        stats.map(_stats => {
          const isServer = _stats.assets.reduce((bool, asset) => {
            if (/server/.test(asset.name)) bool = true
            return bool
          }, false)

          if (isServer) {
            allstats[1] = _stats
          } else {
            allstats[0] = _stats
          }
        })

        /**
         * reset logs
         */
        log({
          error: [],
          warn: [],
          log: [],
          stats: allstats
        })

        if (server) {
          server.update()
        } else {
          serve()
        }

        if (!compiled) {
          createGenerator(config, plugins).watch('/static', '/build/assets')

          compiled = true
        }
      })

      compiler.watch()
    } else {
      serve()
      createGenerator(config, plugins).watch('/static', '/build/assets')
    }
  })

if (!process.argv.slice(2).length) {
  prog.outputHelp(txt => {
    console.log(txt)
    exit()
  })
} else {
  /**
   * fresh console
   */
  console.clear()

  log = require('@rola/log')

  log({ actions: [ 'initializing' ] })

  prog.parse(process.argv)
}
