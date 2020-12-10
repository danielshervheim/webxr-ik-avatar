/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import { BasicScene } from "./basicScene";
import { StudioScene } from "./studioScene";
import { SeparateScene } from "./separateScene";

// Instantiate a scene.
// let scene = new BasicScene();
// let scene = new StudioScene();
let scene = new SeparateScene();

// TODO: currenly the studio scene needs to be updated w/ the BoneDictionary and CalibrationAnimationDictionary classes.

// Start running it.
scene.start();
