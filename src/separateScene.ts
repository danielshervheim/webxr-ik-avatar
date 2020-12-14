/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

// Mirror imports.
import { Mirror } from "./mirror";

import { CalibrationGuide, IKAvatar } from "./ikAvatar";

import { SkeletonBones } from "./skeletonBones";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, MeshAssetTask, SmartArray } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Matrix, Quaternion, Space, Vector3 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects.
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";

// A basic scene test bed for our IKAvatar class.
export class SeparateScene
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private ikAvatar: IKAvatar | null = null;

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);
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

        const xrCamera = xrHelper.baseExperience.camera;

        this.ikAvatar = new IKAvatar(this.scene, xrHelper);

        // Add cones to visualize.
        let visualizationMeshes: SmartArray<AbstractMesh> = new SmartArray<AbstractMesh>(0);
        for (let node of this.ikAvatar.getNodes())
        {
            const cone = MeshBuilder.CreateCylinder(node.name + "_visualizer", {diameterTop: 0.0, diameterBottom: 0.075, height: 0.1}, this.scene);
            cone.setParent(node);
            cone.position = Vector3.Zero();
            cone.rotation = Vector3.Zero();
            cone.scaling = Vector3.One();
            visualizationMeshes.push(cone);
        }
        const rootForwardIndicator = MeshBuilder.CreateCylinder("root_forward_visualizer", {diameterTop: 0.0, diameterBottom: 0.15, height:0.2}, this.scene);
        rootForwardIndicator.setParent(this.ikAvatar.getNodes()[0]);
        rootForwardIndicator.position = new Vector3(0, -0.2, 0.2);
        rootForwardIndicator.rotation = new Vector3(Math.PI/2.0, 0, 0);
        visualizationMeshes.push(rootForwardIndicator);

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: false,
            createSkybox: true,
            skyboxSize: 50,
            skyboxColor: new Color3(0, 0, 0)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.skybox!.isPickable = false;

        // Create a light to light up the scene.
        let light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        let ground = MeshBuilder.CreateGround("Ground", {width:10, height: 10 }, this.scene );
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

            visualizationMeshes.forEach((mesh: AbstractMesh) =>
            {
                mirror.render(mesh);
            });
        });

        const assetsManager = new AssetsManager(this.scene);

        // Load in the guide meshes.
        const textMeshesTask = assetsManager.addMeshTask("loading text meshes", "", "assets/", "textMeshes.glb");
        textMeshesTask.onSuccess = (task: MeshAssetTask) =>
        {
            for (let mesh of task.loadedMeshes)
            {
                if (mesh.name == "1_start_mesh")
                {
                    this.ikAvatar!.bindGuideMesh(CalibrationGuide.START, mesh);
                    mesh.setParent(xrCamera);
                    for (let child of mesh.getChildMeshes())
                    {
                        child.renderingGroupId = 1;
                    }
                    mesh.position = Vector3.Forward().scale(2.0);
                    mesh.rotation = Vector3.Zero();
                    mesh.scaling = Vector3.One().scale(0.1);
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "2_tpose_mesh")
                {
                    this.ikAvatar!.bindGuideMesh(CalibrationGuide.TPOSE, mesh);
                    mesh.setParent(xrCamera);
                    for (let child of mesh.getChildMeshes())
                    {
                        child.renderingGroupId = 1;
                    }
                    mesh.position = Vector3.Forward().scale(2.0);
                    mesh.rotation = Vector3.Zero();
                    mesh.scaling = Vector3.One().scale(0.1);
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "3_finish_mesh")
                {
                    this.ikAvatar!.bindGuideMesh(CalibrationGuide.FINISH, mesh);
                    mesh.setParent(xrCamera);
                    for (let child of mesh.getChildMeshes())
                    {
                        child.renderingGroupId = 1;
                    }
                    mesh.position = Vector3.Forward().scale(2.0);
                    mesh.rotation = Vector3.Zero();
                    mesh.scaling = Vector3.One().scale(0.1);
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "how_to_start_mesh")
                {
                    this.ikAvatar!.bindGuideMesh(CalibrationGuide.HOW_TO_START, mesh);
                    mesh.setParent(null);
                    mesh.position = new Vector3(0, 2, 4);
                    mesh.rotation = Vector3.Zero();
                    mesh.scaling = Vector3.One().scale(0.25);
                }
                else if (mesh.name == "how_to_cancel_mesh")
                {
                    this.ikAvatar!.bindGuideMesh(CalibrationGuide.HOW_TO_CANCEL, mesh);
                    mesh.setParent(null);
                    mesh.position = new Vector3(0, 2, 4);
                    mesh.rotation = Vector3.Zero();
                    mesh.scaling = Vector3.One().scale(0.25);
                }
            }
        }

        // Load in the player avatar.
        const avatarTask = assetsManager.addMeshTask("loading avatar", "", "assets/xbot.babylon", "");
        avatarTask.onSuccess = (task) =>
        {
            if (task.loadedSkeletons.length != 1)
            {
                console.error("expected exactly one skeleton in the loaded avatar.");
            }
            else
            {
                try
                {
                    const bones: SkeletonBones = new SkeletonBones(task.loadedSkeletons[0],
                        "mixamorig:Neck",
                        "mixamorig:Head",

                        "mixamorig:LeftArm",
                        "mixamorig:LeftForeArm",
                        "mixamorig:LeftHand",

                        "mixamorig:RightArm",
                        "mixamorig:RightForeArm",
                        "mixamorig:RightHand"
                    );

                    const meshRoot = new TransformNode("mesh_root");
                    meshRoot.position = Vector3.Zero();

                    for (let mesh of task.loadedMeshes)
                    {
                        mesh.setParent(meshRoot);
                    }

                    meshRoot.scaling = Vector3.One().scale(0.01);

                    this.ikAvatar!.bindSkeletalMesh(meshRoot, task.loadedSkeletons[0], bones);

                    // Render the avatar as well.
                    mirrors.forEach((mirror: Mirror) =>
                    {
                        for (let mesh of task.loadedMeshes)
                        {
                            mirror.render(mesh);
                        }
                    });
                }
                catch(e)
                {
                    console.error(e);
                }
            }
        }

        assetsManager.load();



        this.scene.debugLayer.show();
    }

    private update() : void
    {
        this.ikAvatar?.update(this.engine.getDeltaTime());
    }
}
