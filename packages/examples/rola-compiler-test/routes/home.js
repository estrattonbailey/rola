import React from 'react'
import App from '@/components/App.js'

export const pathname = '/'

export function config () {
  return load()
}

export function load (state, req) {
  return {
    state: {
      title: 'home - hypr - the react toolkit',
      meta: {
        title: 'home - hypr - the react toolkit',
      },
    }
  }
}

export function view ({ pathname, state }) {
  return (
    <App>
      <h1>{state.title}</h1>
    </App>
  )
}
