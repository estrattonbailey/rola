/** @jsx React.createElement */
import React from 'react'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'

const sheets = new Map()

export default (options = {}) => {
  return {
    createDocument ({ context, style }) {
      return {
        head: style
      }
    },
    createServerRoot ({ root: Root, context }) {
      const sheet = new ServerStyleSheet()

      sheets.set(context.pathname, sheet)

      return props => <StyleSheetManager sheet={sheet.instance}><Root {...props} /></StyleSheetManager>
    },
    postServerRender ({ context }) {
      const sheet = sheets.get(context.pathname)

      if (!sheet) return {}

      const style = sheet.getStyleTags()

      sheet.seal()
      sheets.delete(context.pathname)

      return { style }
    }
  }
}
