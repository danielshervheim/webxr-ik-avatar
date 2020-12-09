/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

// IKAvatar imports.
import { BoneDictionary, CalibrationAnimationDictionary, Side, IKAvatar } from "./ikAvatar";

// Mirror imports.
import { Mirror } from "./mirror";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, SmartArray } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects.
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";

// These meshes are hidden from the XR camera, but are still rendered in mirrors.
// This is useful to hide the head mesh, for example, since the XR camera is usually
// inside the avatars head.
const hideFromXRCamera = [
    "EyeLeft",
    "EyeRight",
    "Wolf3D_Head",
    "Wolf3D_Teeth"
];

// A basic scene test bed for our IKAvatar class.
export class BasicScene
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private ikAvatar: IKAvatar;

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        // Initialize a new IKAvatar instance.
        this.ikAvatar = new IKAvatar(this.scene);
    }

    start() : void
    {
        // Create the scene and then execute this function afterwards
        this.createScene().then(() =>
        {

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() =>
            {
                this.update();
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () =>
            {
                this.engine.resize();
            });
        });
    }

    private async createScene()
    {
        // This creates and positions a first-person camera (non-mesh)
        let camera = new UniversalCamera("camera1", new Vector3(0, 1.6, 0), this.scene);
        camera.fov = 90 * Math.PI / 180;
        camera.minZ = .1;
        camera.maxZ = 100;

        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);
        camera.speed = 0.2;

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Disable teleportation and the laser pointer
        xrHelper.teleportation.dispose();
        xrHelper.pointerSelection.dispose();

        // Register the XR Helper with the IKAvatar.
        this.ikAvatar.registerXRExperience(xrHelper);

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: true,
            groundSize: 50,
            // groundColor: new Color3(0, 0, 0),
            createSkybox: true,
            skyboxSize: 50,
            skyboxColor: new Color3(0, 0, 0)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.ground!.isPickable = false;
        environment!.skybox!.isPickable = false;

        // Create a light to light up the scene.
        let light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // Create an AssetManager to load in data.
        let assetsManager = new AssetsManager(this.scene);

        // Load the avatar mesh and register the loaded avatar mesh with the IKAvatar.
        // let avatarTask = assetsManager.addMeshTask( "avatar task", "", "assets/HVGirl.glb", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        let avatarTask = assetsManager.addMeshTask("avatar task", "", "assets/ybot/ybot.babylon", "");
        avatarTask.onSuccess = (task) =>
        {
            let boneDictionary = new BoneDictionary(
                "mixamorig:RightArm",
                "mixamorig:RightForeArm",
                "mixamorig:RightHand",
                "mixamorig:RightHandMiddle4",
                "mixamorig:LeftArm",
                "mixamorig:LeftForeArm",
                "mixamorig:LeftHand",
                "mixamorig:LeftHandMiddle4"
            );
            let animationDictionary = new CalibrationAnimationDictionary(
                "YBot_Idle",
                "YBot_TPose",
                "YBot_TPose",
                "YBot_Celebrate"
            );
            this.ikAvatar.registerCalibrationAvatarFromMeshTask(task,
                boneDictionary, animationDictionary, new Vector3(0, 0, 3),
                new Vector3(0, 0, 0), Vector3.One().scale(0.01));
        }

        // Load the user mesh and register it with the IKAvatar.
        let userTask = assetsManager.addMeshTask( "user task", "", "assets/xbot/xbot.babylon", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        userTask.onSuccess = (task) =>
        {
            let boneDictionary = new BoneDictionary(
                "mixamorig:RightArm",
                "mixamorig:RightForeArm",
                "mixamorig:RightHand",
                "mixamorig:RightHandMiddle4",
                "mixamorig:LeftArm",
                "mixamorig:LeftForeArm",
                "mixamorig:LeftHand",
                "mixamorig:LeftHandMiddle4"
            );
            this.ikAvatar.registerUserAvatarFromMeshTask(task,
                boneDictionary, new Vector3(0, 0, 0), new Vector3(0, -3.14159, 0),
                Vector3.One().scale(0.01));
        }

        let ground = MeshBuilder.CreateGround("Ground", { width:10, height: 10 }, this.scene );
            ground.position = new Vector3( 0, 0.001, 0 );
            ground.overlayColor = new Color3( 0.2, 0.2, 0.25 );
            ground.renderOverlay = true;

        let redMaterial = new StandardMaterial("red", this.scene);
            redMaterial.diffuseColor = new Color3(1, 0, 0);

        let sphere = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
            sphere.position = new Vector3( 1, 1.5, -1);
            sphere.material = redMaterial;

        // Create the mirrors.
        let mirrors: SmartArray<Mirror> = new SmartArray<Mirror>(4);

        mirrors.push(new Mirror(
            "mirror_1",
            new Vector3(0, 2.5, 5),
            new Vector3(0, Math.PI/2.0 * 0, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirror_2",
            new Vector3(5, 2.5, 0),
            new Vector3(0, Math.PI/2.0 * 1, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirror_3",
            new Vector3(0, 2.5, -5),
            new Vector3(0, Math.PI/2.0 * 2, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirror_4",
            new Vector3(-5, 2.5, 0),
            new Vector3(0, Math.PI/2.0 * 3, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        // Register the ground and sphere with all mirrors.
        mirrors.forEach((mirror: Mirror) =>
        {
            mirror.render(sphere);
            mirror.render(ground);
            mirror.render(environment!.skybox!);
            mirror.render(environment!.ground!);
        });

        // Load the assets.
        assetsManager.load();

        assetsManager.onFinish = (tasks) =>
        {
            // Hide specified meshes from the XR camera.
            for (let meshToHideName of hideFromXRCamera)
            {
                let meshToHide: AbstractMesh | null = this.scene.getMeshByName(meshToHideName);
                if (meshToHide)
                {
                    meshToHide.layerMask = 0x00000000;
                }
            }

            // Set each user mesh to reflect off the mirrors.
            if (userTask)
            {
                userTask.loadedMeshes.forEach((mesh) =>
                {
                    mirrors.forEach((mirror: Mirror) =>
                    {
                        mirror.render(mesh);
                    });
                });
            }

            // Set each avatar mesh to reflect off the mirrors and stop the default
            // idling animation.
            if (avatarTask)
            {
                avatarTask.loadedMeshes.forEach((mesh) =>
                {
                    mirrors.forEach((mirror: Mirror) =>
                    {
                        mirror.render(mesh);
                    });
                });

                const idleAnim = this.scene.getAnimationGroupByName("Idle");
                if (idleAnim)
                {
                    idleAnim.stop();
                }
            }

            // Signal to the IKAvatar that all the required assets are loaded, so
            // it can finish setting itself up.
            this.ikAvatar.initialize();

            // Show the debug layer
            this.scene.debugLayer.show();
        }
    }

    private update() : void
    {
        // Update the IKAvatar.
        this.ikAvatar.update();
    }
}
