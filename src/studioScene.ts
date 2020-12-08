/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

// IKAvatar imports.
import { IKAvatar } from "./ikAvatar";

// Mirror imports.
import { Mirror } from "./mirror";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, SmartArray } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
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

// A studio scene test bed for our IKAvatar class.
export class StudioScene
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private ikAvatar: IKAvatar;

    private lightmapDictionary : { [id: string] : Array<string>; } = {};
    private lightmapTextures : { [id: string] : Texture | null } = {};

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        // Setup the lightmap dictionary. Unfortunately this is necessary
        // because GLB does not natively support embedded lightmaps in materials.
        this.lightmapDictionary["bar_lightmap.jpeg"] = [
            "bar",
        ];

        this.lightmapDictionary["wall_lightmap.jpeg"] = [
            "middle_wall",
        ];

        this.lightmapDictionary["windows_lightmap.jpeg"] = [
            "bar_windows",
            "curtains",
        ];

        this.lightmapDictionary["kitchen_lightmap.jpeg"] = [
            "cabinets",
            "sink",
            "countertop",
            "bar_kitchen",
        ];

        this.lightmapDictionary["props_a_lightmap.jpeg"] = [
            "frames_wall",
            "doors_double",
            "door_single",
            "tv_frame",
        ];

        this.lightmapDictionary["walls_lightmap.jpeg"] = [
            "floor_lamp_gray",
            "ceiling",
            "wall_double_doors",
            "wall_entry",
            "wall_kitchen",
            "wall_table",
            "floor",
        ];

        this.lightmapDictionary["props_big_lightmap.jpeg"] = [
            "chair_top",
            "chair_legs",
            "ottoman",
            "rug",
            "couch",
            "console",
            "shelves",
            "table",
            "tv_screen",
        ];

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
        let camera = new UniversalCamera("Camera", new Vector3(0, 1.6, 0), this.scene);
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
        this.ikAvatar.registerXRHelper(xrHelper);

        // Creates a default environment.
        const environment = this.scene.createDefaultEnvironment({
            createGround: false,
            createSkybox: true,
            skyboxSize: 50,
            skyboxColor: new Color3(1, 1, 1)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.skybox!.isPickable = false;

        // Create an AssetManager to load in data.
        let assetsManager = new AssetsManager(this.scene);

        // Load the avatar mesh and register the loaded avatar mesh with the IKAvatar.
        let avatarTask = assetsManager.addMeshTask( "avatar task", "", "assets/HVGirl.glb", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        avatarTask.onSuccess = (task) =>
        {
            this.ikAvatar.registerCalibrationAvatarFromMeshTask(task);
        }

        // Load the user mesh and register it with the IKAvatar.
        let userTask = assetsManager.addMeshTask( "user task", "", "assets/userAvatar.glb", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        userTask.onSuccess = (task) =>
        {
            this.ikAvatar.registerUserAvatarFromMeshTask(task);
        }

        // Load the lightmaps.
        for (let lightmap in this.lightmapDictionary)
        {
            let loadLightmap = assetsManager.addTextureTask("loading lightmap (" + lightmap + ")", 'assets/lightmaps/' + lightmap, false, false);
            loadLightmap.onSuccess = (task)=>
            {
                task.texture.coordinatesIndex = 1;
                this.lightmapTextures[lightmap] = task.texture;
            }
            loadLightmap.onError = (task)=>
            {
                console.error("failed to load lightmap (" + lightmap + ")");
            }
        }

        // Create the mirrors.
        let mirrors: SmartArray<Mirror> = new SmartArray<Mirror>(2);

        mirrors.push(new Mirror(
            "mirrorByWall",
            new Vector3(-6.856, 1.943, 4),
            new Vector3(0, 270 * ( Math.PI / 180 ), 0),
            new Vector3(1.0, 0.6, 0.1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirrorByDoor",
            new Vector3( -2.9, 1.873, 10.020 ),
            new Vector3(0, 0, 0),
            new Vector3(0.247, 0.7, 0.002),
            5,
            5,
            512,
            this.scene
        ));

        // Register the skybox with all mirrors.
        mirrors.forEach((mirror: Mirror)=>
        {
            mirror.render(environment!.skybox!);
        });

        // Load the world mesh and scale it appropriately.
        var worldTask = assetsManager.addMeshTask("world task", "", "assets/world2.glb", "");
        worldTask.onSuccess = (task) => {
            worldTask.loadedMeshes[0].name = "world";
            worldTask.loadedMeshes[0].position = new Vector3( 0, 0.001, 0);
            worldTask.loadedMeshes[0].rotation = new Vector3( 0, 0, 0);
            worldTask.loadedMeshes[0].scaling = new Vector3(1.25, 1.25, 1.25);
        }

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
            
            // Set each world mesh to reflect off the mirrors.
            if (worldTask)
            {
                worldTask.loadedMeshes.forEach((mesh) =>
                {
                    mirrors.forEach((mirror: Mirror) =>
                    {
                        mirror.render(mesh);
                    });

                    /*
                    // Leave in for now as template if loaded asset file needs manipulating
                    // Note this condition will always evaluate true as there are no point or sun meshes
                    // in the scene
                    if(!(mesh.name.startsWith("Point")) && !(mesh.name.startsWith("Sun") ) )
                    {
                        mirrors.forEach((mirror: Mirror)=>
                        {
                            mirror.render(mesh);
                        });
                    }
                    */
                });
            }

            // Set each user mesh to reflect off the mirrors.
            if (userTask)
            {
                userTask.loadedMeshes.forEach((mesh) =>
                {
                    mirrors.forEach((mirror: Mirror)=>
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
                    mirrors.forEach((mirror: Mirror)=>
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

            // Assign the lightmaps to their materials.
            for (let lightmap in this.lightmapDictionary)
            {
                if (this.lightmapTextures[lightmap])
                {
                    for (let materialName of this.lightmapDictionary[lightmap])
                    {
                        let material = this.scene.getMaterialByName(materialName);
                        if (material)
                        {
                            let lightmapTexture: Texture = this.lightmapTextures[lightmap]!;
                            // Set the lightmap
                            (<PBRMaterial>material).lightmapTexture = lightmapTexture;
                            (<PBRMaterial>material).useLightmapAsShadowmap = true;
                        }
                        else
                        {
                            console.error("didn't find material (" + materialName + ")");
                        }
                    }
                }

            }

            // Signal to the IKAvatar that all the required assets are loaded, so
            // it can finish setting itself up.
            this.ikAvatar.onAssetsLoaded();

            // Set a few post-processing settings to make the environment look better.
            this.scene.imageProcessingConfiguration.exposure = 1.5;
            this.scene.imageProcessingConfiguration.contrast = 1.5;
            this.scene.environmentIntensity = 1.5;

            // Show the debug layer.
            this.scene.debugLayer.show();
        }
    }

    private update() : void
    {
        // Update the IKAvatar.
        this.ikAvatar.update();
    }
}
