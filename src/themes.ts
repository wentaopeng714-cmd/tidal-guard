export const BIOMES = [
  { name:'阳光海岸', icon:'☀', kind:'beach', road:0xb89ba7, accent:0x42b9ad, sun:0xffefd6, weather:'暖风 · 贝壳与椰林', colors:['#f8ebc2','#f5dfc7','#f3d0ba'] },
  { name:'薄荷森林', icon:'♣', kind:'forest', road:0x9fae91, accent:0x699f6c, sun:0xeaffdf, weather:'林间微光 · 蘑菇与松树', colors:['#dce9c4','#cbe1be','#bed8c7'] },
  { name:'赤金沙漠', icon:'◇', kind:'desert', road:0xba8271, accent:0xe19b5f, sun:0xffdbb0, weather:'干燥热风 · 仙人掌与砂岩', colors:['#f3d6ac','#edc297','#e8b49d'] },
  { name:'浮冰雪原', icon:'❄', kind:'snow', road:0x9eb9cc, accent:0x80b4cf, sun:0xe3f4ff, weather:'静谧雪地 · 冰锥与雪松', colors:['#e1f0f1','#d3e5ed','#c6dce9'] },
  { name:'暮光晶谷', icon:'✦', kind:'crystal', road:0x9287b7, accent:0xb087d3, sun:0xf2dbff, weather:'暮色微光 · 水晶与星砂', colors:['#e0d4ee','#d1c3e3','#c2b3d8'] },
] as const;
export function stageTheme(level: number) {
  const biome=BIOMES[Math.floor((level-1)/3)];
  return { ...biome, ground:biome.colors[(level-1)%3], variant:(level-1)%3, label:`${biome.name} · ${['晨光','漫游','深处'][(level-1)%3]}` };
}
