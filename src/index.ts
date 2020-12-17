/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import { StudioSceneCCD } from "./studioScene_CCD";
import { BasicSceneCCD } from "./basicScene_CCD";

import { StudioSceneBoneIK } from "./studioScene_BoneIK";
import { BasicSceneBoneIK } from "./basicScene_BoneIK";

// Instantiate a scene.
// let scene = new BasicSceneBoneIK();
// let scene = new StudioSceneBoneIK();
let scene = new BasicSceneCCD();
// let scene = new StudioSceneCCD();

// Start running it.
scene.start();
