# The Study

A 3D desk you can sit down at, with a working desktop OS on the monitor.

**Try it:** [the-study-five.vercel.app](https://the-study-five.vercel.app)

I built this for the fun of it, to see how far I could push a small explorable world in the browser.

## What's in it

- **A real 3D room.** I put the office together myself in Blender (desk, monitor, shelf, guitar, radio and a lot of desk clutter) and it renders live in the browser with real lighting.
- **A working computer.** The monitor runs a little desktop OS with windows you can open, move and close: About, Notes, a Terminal, a Trash can, and a game called Topple the Tower.
- **Things to find.** There are seven hidden discoveries around the room and on the computer. I won't spoil them.
- **Works without the 3D.** If a browser can't run WebGL, or someone prefers reduced motion, the same desktop opens full screen so everything still works. On phones it suggests a bigger screen.

## Built with

Next.js and TypeScript, three.js through React Three Fiber and Drei, and Framer Motion. Most of the room's props are free CC0 models from Poly Haven plus a few from Sketchfab.

## Run it locally

```bash
npm install
npm run dev
```

Then open [localhost:3000](http://localhost:3000).

More of my work: [tylerkirkland.com](https://tylerkirkland.com)
