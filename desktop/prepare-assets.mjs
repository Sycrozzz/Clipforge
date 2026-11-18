
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const fonts = [
  ["montserrat/900Black/Montserrat_900Black.ttf", "Montserrat_900Black.ttf"],
  ["montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf", "Montserrat_800ExtraBold.ttf"],
  ["anton/400Regular/Anton_400Regular.ttf", "Anton_400Regular.ttf"],
  ["bangers/400Regular/Bangers_400Regular.ttf", "Bangers_400Regular.ttf"],
  ["poppins/800ExtraBold/Poppins_800ExtraBold.ttf", "Poppins_800ExtraBold.ttf"],
  ["poppins/700Bold/Poppins_700Bold.ttf", "Poppins_700Bold.ttf"],
  ["montserrat/700Bold/Montserrat_700Bold.ttf", "Montserrat_700Bold.ttf"],
];

const sourceRoot = path.join(process.cwd(), "node_modules/@expo-google-fonts");
const destination = path.join(process.cwd(), "assets/fonts");

mkdirSync(destination, { recursive: true });

for (const [source, filename] of fonts) {
  const from = path.join(sourceRoot, source);
  const to = path.join(destination, filename);

  if (!existsSync(from)) {
    throw new Error(`Missing font package file: ${from}`);
  }

  copyFileSync(from, to);
  console.log(`Copied ${filename}`);
}

console.log("All seven ClipForge fonts prepared.");
