import { test, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
const prefs={view:'2d',theme:'atelier',opponent:'local',humanColor:'w',difficulty:'2',flipped:false,hints:true,sound:false,coordinates:true};
async function init(page,options={},game){
  await page.addInitScript(({prefs,game})=>localStorage.setItem('atelier-chess-v1',JSON.stringify({prefs,game})),{prefs:{...prefs,...options},game});
  await page.goto('./');await expect(page.locator('#status')).toContainText('to move');
}
async function move(page,from,to){await page.locator(`[data-square="${from}"]`).click();await page.locator(`[data-square="${to}"]`).click();}
test('2D play, illegal moves, capture, undo, flip, settings and new game',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await init(page);
  await expect(page.locator('.square')).toHaveCount(64);await expect(page.locator('.square .piece')).toHaveCount(32);
  await move(page,'e2','e5');await expect(page.locator('[data-square="e2"] .piece')).toHaveCount(1);
  await move(page,'e2','e4');await expect(page.locator('#status')).toHaveText('Black to move');
  await move(page,'d7','d5');await move(page,'e4','d5');await expect(page.locator('.square .piece')).toHaveCount(31);
  await page.keyboard.press('u');await expect(page.locator('.square .piece')).toHaveCount(32);await expect(page.locator('[data-square="e4"] .piece-w')).toHaveCount(1);
  await page.keyboard.press('f');await expect(page.locator('.square').first()).toHaveAttribute('data-square','h1');
  await page.locator('#settings-toggle').click();await page.locator('[data-theme="nocturne"]').click();await expect(page.locator('body')).toHaveAttribute('data-theme','nocturne');
  await page.locator('#new-game').click();await page.locator('#confirmation-ok').click();await expect(page.locator('#status')).toHaveText('White to move');await expect(page.locator('.square .piece')).toHaveCount(32);expect(errors).toEqual([]);
});
test('promotion is explicit and offers every piece',async({page})=>{
  await init(page,{}, {fen:'7k/P7/8/8/8/8/8/7K w - - 0 1'});await move(page,'a7','a8');await expect(page.locator('#promotion')).toBeVisible();await expect(page.locator('[data-promote]')).toHaveCount(4);await page.getByRole('button',{name:'Promote to rook',exact:true}).click();await expect(page.locator('[data-square="a8"]')).toHaveAttribute('aria-label','a8, White rook');
});
test('checkmate result, review, and takeback',async({page})=>{
  await init(page);for(const [from,to] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']])await move(page,from,to);
  await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#result-title')).toHaveText('Black takes the game.');await page.locator('#review-board').click();await page.keyboard.press('u');await expect(page.locator('#status')).toHaveText('Black to move');
});
test('computer responds legally and takeback restores the pair',async({page})=>{
  await init(page,{opponent:'computer',difficulty:'1'});await move(page,'e2','e4');await expect(page.locator('#status')).toHaveText('White to move',{timeout:10000});await expect(page.locator('#move-count')).toHaveText('1 move');await page.keyboard.press('u');await expect(page.locator('[data-square="e2"] .piece-w')).toHaveCount(1);await expect(page.locator('#move-count')).toHaveText('0 moves');
});
test('3D renders, shares moves with 2D and switches palettes',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await init(page,{view:'3d'});
  await expect(page.locator('#board-3d canvas')).toBeVisible();await page.waitForTimeout(1200);await page.screenshot({path:'test-results/atelier-3d.png'});
  await page.keyboard.press('v');await expect(page.locator('#board-2d')).toBeVisible();await move(page,'e2','e4');await page.waitForTimeout(300);await page.screenshot({path:'test-results/atelier-2d.png'});
  await page.keyboard.press('v');await expect(page.locator('#board-3d canvas')).toBeVisible();await expect(page.locator('#status')).toHaveText('Black to move');
  await page.locator('#settings-toggle').click();await page.locator('[data-theme="nocturne"]').click();await page.waitForTimeout(300);await page.screenshot({path:'test-results/settings.png'});await page.locator('.close-dialog').click();await page.waitForTimeout(500);await page.screenshot({path:'test-results/nocturne-3d.png'});expect(errors).toEqual([]);
});
function projected(square,height=.31){
  const camera=new PerspectiveCamera(34,1440/1000,.1,150);camera.position.set(7.3,12.8,15);camera.lookAt(0,.1,0);camera.updateMatrixWorld();
  const p=new Vector3(square.charCodeAt(0)-100.5,height,4.5-Number(square[1])).project(camera);
  return {x:(p.x+1)*720,y:(1-p.y)*500};
}
test('actual 3D pointer picking, drag, castling and undo',async({page})=>{
  await init(page,{view:'3d'},{fen:'r3k2r/ppp2ppp/8/3pp3/3PP3/8/PPP2PPP/R3K2R w KQkq - 0 1'});
  await expect(page.locator('#board-3d canvas')).toBeVisible();await page.waitForTimeout(350);
  const king=projected('e1',1.3),castle=projected('g1');
  await page.mouse.click(king.x,king.y);await expect(page.locator('[data-square="e1"]')).toHaveAttribute('aria-pressed','true');
  await page.mouse.click(castle.x,castle.y);await expect(page.locator('#status')).toHaveText('Black to move');await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label','f1, White rook');
  await page.waitForTimeout(350);const pawn=projected('d5',.95),capture=projected('e4',.8);
  await page.mouse.move(pawn.x,pawn.y);await page.mouse.down();await page.mouse.move(capture.x,capture.y,{steps:12});await page.mouse.up();
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label','e4, Black pawn');
  await page.keyboard.press('u');await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label','e4, White pawn');
});
test('2D drag and keyboard-only moves',async({page})=>{
  await init(page);const a=await page.locator('[data-square="e2"]').boundingBox(),b=await page.locator('[data-square="e4"]').boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await expect(page.locator('#status')).toHaveText('Black to move');
  await page.locator('[data-square="e7"]').focus();await page.keyboard.press('Enter');await page.locator('[data-square="e5"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#status')).toHaveText('White to move');
});
test('autosave survives reload and contains no runtime external requests',async({page})=>{
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('autosave-test-seeded')){
      localStorage.setItem('atelier-chess-v1',JSON.stringify({prefs:{view:'2d',sound:false}}));
      sessionStorage.setItem('autosave-test-seeded','true');
    }
  });
  await page.goto('./');
  const origin=new URL(page.url()).origin;
  const external=[];page.on('request',r=>{if(!r.url().startsWith(origin+'/')&&!r.url().startsWith('data:'))external.push(r.url());});
  await move(page,'e2','e4');await page.reload();await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label','e4, White pawn');await expect(page.locator('#status')).toHaveText('Black to move');expect(external).toEqual([]);
});
test('mobile layout and board interaction',async({page})=>{
  await page.setViewportSize({width:390,height:844});await init(page);await move(page,'e2','e4');await expect(page.locator('#status')).toHaveText('Black to move');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/mobile-2d.png'});
  await page.locator('#settings-toggle').click();await expect(page.locator('#settings')).toBeVisible();await page.locator('[data-view="3d"]').click();await page.locator('.close-dialog').click();await page.waitForTimeout(700);await page.screenshot({path:'test-results/mobile-3d.png'});
});
test('3D load failure falls back to a playable classic board',async({page})=>{
  await page.route('**/src/board3d.js*',route=>route.abort());
  await init(page,{view:'3d'});await expect(page.locator('#board-2d')).toBeVisible();await move(page,'e2','e4');await expect(page.locator('#status')).toHaveText('Black to move');
});
