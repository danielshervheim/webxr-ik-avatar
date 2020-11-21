/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
import { Logger } from "@babylonjs/core/Misc/logger";
import { AssetsManager } from "@babylonjs/core";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Plane } from "@babylonjs/core/Maths/math.plane"

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";

// Import debug layer
import "@babylonjs/inspector";

const loadStudioScene = false;

/******* Start of the Game class ******/
class Game
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private xrCamera: WebXRCamera | null;
    private leftController: WebXRInputSource | null;
    private rightController: WebXRInputSource | null;

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        // Initialize XR member variables to null
        this.xrCamera = null;
        this.leftController = null;
        this.rightController = null;
    }

    start() : void
    {
        // Create the scene and then execute this function afterwards
        this.createScene().then(() => {

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() => {
                this.update();
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () => {
                this.engine.resize();
            });
        });
    }

    private async createScene()
    {
        // This creates and positions a first-person camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(0, 1.6, 0), this.scene);
        camera.fov = 90 * Math.PI / 180;
        camera.minZ = .1;
        camera.maxZ = 100;

        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Disable teleportation and the laser pointer
        xrHelper.teleportation.dispose();
        xrHelper.pointerSelection.dispose();

        // Assign the xrCamera to a member variable
        this.xrCamera = xrHelper.baseExperience.camera;

        // Assigns the controllers
        xrHelper.input.onControllerAddedObservable.add((inputSource) =>
        {
            if(inputSource.uniqueId.endsWith("left"))
            {
                this.leftController = inputSource;
            }
            else
            {
                this.rightController = inputSource;
            }
        });

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: true,
            groundSize: 50,
            skyboxSize: 50,
            skyboxColor: new Color3(0, 0, 0)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.ground!.isPickable = false;
        environment!.skybox!.isPickable = false;

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        var light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        // The assets manager can be used to load multiple assets
        var assetsManager = new AssetsManager(this.scene);

        // Create a task for each asset you want to load
        var avatarTask       = assetsManager.addMeshTask( "avatar task", "", "assets/HVGirl.glb", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        avatarTask.onSuccess = (task) => {
            avatarTask.loadedMeshes[0].name    = "hero";
            avatarTask.loadedMeshes[0].scaling = new Vector3( 0.1, 0.1, 0.1 );
        }
        var mirrorTexture1 : MirrorTexture;
        var mirrorTexture2 : MirrorTexture;
        var mirrorTexture3 : MirrorTexture;
        var mirrorTexture4 : MirrorTexture;
        if( loadStudioScene )
        {
            // Setup 2 Mirrored Surfaces in the scene
            // Test Object to reflect
            var redMaterial             = new StandardMaterial("red", this.scene);
            redMaterial.diffuseColor    = new Color3(1, 0, 0);

            var sphere = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
            sphere.position = new Vector3( 1, 1.5, -1);//.y = 1.5;
            sphere.material = redMaterial;
            var i : number;
            for( i = 0; i < 2; i++)
            {
                var glass = MeshBuilder.CreatePlane("glass", {width: 5, height: 5}, this.scene);
                switch(i)
                {
                    case 0:
                        glass.position = new Vector3( -2.49, 1.269, -1.037 );
                        glass.scaling  = new Vector3( 0.575, 0.5, 0.1 );
                        glass.rotation = new Vector3( 0, 270 * ( Math.PI / 180 ), 0);
                        break;
                    case 1:
                        glass.position = new Vector3( 0.01, 1.055, 2.378 );
                        glass.scaling  = new Vector3( 0.099, 0.415, 0.002 );
                        glass.rotation = new Vector3( 5.080 * ( Math.PI / 180 ), 0, 0 );
                        break;
                }
                //Ensure working with new values for glass by computing and obtaining its worldMatrix
                glass.computeWorldMatrix(true);
                var glass_worldMatrix = glass.getWorldMatrix();

                //Obtain normals for plane and assign one of them as the normal
                var glass_vertexData = glass.getVerticesData("normal");
                var glassNormal      = new Vector3(glass_vertexData![0], glass_vertexData![1], glass_vertexData![2]);
                //Use worldMatrix to transform normal into its current value
                glassNormal = Vector3.TransformNormal(glassNormal, glass_worldMatrix)

                //Create reflecting surface for mirror surface
                var reflector = Plane.FromPositionAndNormal(glass.position, glassNormal.scale(-1));

                var mirror1Material = new StandardMaterial("mirror", this.scene);
                var mirror2Material = new StandardMaterial("mirror", this.scene);
                switch(i)
                {
                    case 0:
                        Logger.Log("mirror texture 1");
                        //Create the mirror material
                        mirrorTexture1                    = new MirrorTexture("mirror1", 1024, this.scene, true);
                        mirrorTexture1.mirrorPlane        = reflector;
                        mirrorTexture1.renderList         = [sphere];
                        mirrorTexture1.level              = 1;
                        mirror1Material.reflectionTexture = mirrorTexture1;
                        glass.material                    = mirror1Material;
                        break;
                    case 1:
                        Logger.Log("mirror texture 2");
                        //Create the mirror material
                        mirrorTexture2                    = new MirrorTexture("mirror2", 1024, this.scene, true);
                        mirrorTexture2.mirrorPlane        = reflector;
                        mirrorTexture2.renderList         = [sphere];
                        mirrorTexture2.level              = 1;
                        mirror2Material.reflectionTexture = mirrorTexture2;
                        glass.material                    = mirror2Material;
                        break;
                }
            }

            // Create a task for each asset you want to load
            var worldTask       = assetsManager.addMeshTask("world task", "", "assets/world.glb", "");
            worldTask.onSuccess = (task) => {
                worldTask.loadedMeshes[0].name      = "world";
                worldTask.loadedMeshes[0].position  = new Vector3( 0, 0.001, 0);
                worldTask.loadedMeshes[0].scaling   = new Vector3(1.25, 1.25, 1.25);
            }
        }
        else
        {  // Just 4 Mirrors, a floor, and test sphere
            var ground               = MeshBuilder.CreateGround("Ground", { width:10, height: 10 }, this.scene );
                ground.position      = new Vector3( 0, 0.001, 0 );
                ground.overlayColor  = new Color3( 0.2, 0.2, 0.25 );
                ground.renderOverlay = true;

            var redMaterial              = new StandardMaterial("red", this.scene);
                redMaterial.diffuseColor = new Color3(1, 0, 0);

            var sphere          = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
                sphere.position = new Vector3( 1, 1.5, -1);
                sphere.material = redMaterial;

           //Creation of a glass planes
            for(var i = 0; i < 4; i++) {
                var glass = MeshBuilder.CreatePlane("glass", {width: 5, height: 5}, this.scene);
                switch(i)
                {
                    case 0:
                        glass.position = new Vector3( 0, 2.5, 5);
                        break;
                    case 1:
                        glass.position = new Vector3( 5, 2.5, 0);
                        break;
                    case 2:
                        glass.position = new Vector3( 0, 2.5, -5);
                        break;
                    case 3:
                        glass.position = new Vector3( -5, 2.5, 0);
                        break;
                }
                    glass.rotation = new Vector3(0, i * Math.PI / 2, 0);

                //Ensure working with new values for glass by computing and obtaining its worldMatrix
                glass.computeWorldMatrix(true);
                var glass_worldMatrix = glass.getWorldMatrix();

                //Obtain normals for plane and assign one of them as the normal
                var glass_vertexData = glass.getVerticesData("normal");
                var glassNormal      = new Vector3(glass_vertexData![0], glass_vertexData![1], glass_vertexData![2]);
                //Use worldMatrix to transform normal into its current value
                glassNormal = Vector3.TransformNormal(glassNormal, glass_worldMatrix)

                //Create reflecting surface for mirror surface
                var reflector = Plane.FromPositionAndNormal(glass.position, glassNormal.scale(-1));

                //Create MirrorTexture
                var mirrorText             = new MirrorTexture("mirror", 1024, this.scene, true);
                    mirrorText.mirrorPlane = reflector;
                    mirrorText.renderList  = [sphere];
                    mirrorText.level       = 1;
                //Create the mirror material
                var mirrorMaterial                   = new StandardMaterial("mirror", this.scene);
                    mirrorMaterial.reflectionTexture = mirrorText;
                switch(i)
                {
                    case 0:
                        mirrorTexture1 = mirrorText;
                        break;
                    case 1:
                        mirrorTexture2 = mirrorText;
                        break;
                    case 2:
                        mirrorTexture3 = mirrorText;
                        break;
                    case 3:
                        mirrorTexture4 = mirrorText;
                        break;

                }
                glass.material = mirrorMaterial;
            }
        }
        // This loads all the assets and displays a loading screen
        assetsManager.load();

        // This will execute when all assets are loaded
        assetsManager.onFinish = (tasks) =>
        {
            if( worldTask && loadStudioScene )
            {
                this.scene.transformNodes.forEach((node) =>
                {
                    // Remove Asset Lights from the scene which cause mirror surfaces to be overexposed
                    if(node.name.startsWith("Point") || node.name.startsWith("Sun"))
                    {
                        node.setEnabled(false);
                    }
                })
                worldTask.loadedMeshes.forEach((mesh) =>
                {
                    // Leave in for now as template if loaded asset file needs manipulating
                    // Note this condition will always evaluate true as there are no point or sun meshes
                    // in the scene
                    if( !(mesh.name.startsWith("Point")) && !(mesh.name.startsWith("Sun") ) )
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                    }
                });
            }
            // Always hit
            if( avatarTask )
            {
                avatarTask.loadedMeshes.forEach((mesh) =>
                {
                    if( loadStudioScene )
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                    }
                    else
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                        mirrorTexture3.renderList!.push(mesh);
                        mirrorTexture4.renderList!.push(mesh);
                    }
                });
                const sambaAnim = this.scene.getAnimationGroupByName("Samba");
                if( sambaAnim )
                {
                    sambaAnim.start(true, 1.0, sambaAnim.from, sambaAnim.to, false);
                }

            }
            // Show the debug layer
            this.scene.debugLayer.show();
        }
    }

    // The main update loop will be executed once per frame before the scene is rendered
    private update() : void
    {

    }

}
/******* End of the Game class ******/

// start the game
var game = new Game();
game.start();