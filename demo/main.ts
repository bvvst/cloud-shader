import { createSky, type Sky, type SkyTheme } from '../src'

const hero = document.getElementById('hero')!
const toggle = document.getElementById('toggle')!

let theme: SkyTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
let sky: Sky | undefined

function render() {
  sky?.destroy()
  sky = createSky(hero, { theme })
  document.body.classList.toggle('night', theme === 'night')
  toggle.textContent = theme === 'day' ? 'Switch to night' : 'Switch to day'
}

toggle.addEventListener('click', () => {
  theme = theme === 'day' ? 'night' : 'day'
  render()
})

render()
