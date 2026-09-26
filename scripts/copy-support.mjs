import {copyFileSync} from "node:fs";
for(const name of ["styles.css","models.d.mts","vite.mjs","vite.d.mts"])copyFileSync(new URL(`../src/${name}`,import.meta.url),new URL(`../dist/${name}`,import.meta.url));
