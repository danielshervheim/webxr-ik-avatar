/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

// IKAvatar imports.
import { BoneDictionary, CalibrationAnimationDictionary, Side, BoneIKAvatar } from "./boneIKAvatar/boneIKAvatar";

// Mirror imports.
import { Mirror } from "./mirror";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
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
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllercomponent";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Ray } from "@babylonjs/core/Culling/ray";

// Side effects.
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";

// These meshes are hidden from the XR camera, but are still rendered in mirrors.
// This is useful to hide the head mesh, for example, since the XR camera is usually
// inside the avatars head.
const hideFromXRCamera = [
    "xbot_Head",
    "xbot_neck"
];

// A basic scene test bed for our IKAvatar class.
export class BasicSceneBoneIK
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private ikAvatar: BoneIKAvatar;

    //Teleportation
    private worldTransform: TransformNode;
    private rightController: WebXRInputSource | null;
    private laserPointer: LinesMesh | null;
    private teleportPoint: Vector3 | null;
    private teleportTransform: TransformNode;
    private groundMeshes: Array<AbstractMesh>;
    private mirrors: SmartArray<Mirror>;

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        // Initialize a new BoneIKAvatar instance.
        this.ikAvatar = new BoneIKAvatar(this.scene);

        this.rightController   = null;
        this.laserPointer      = null;
        this.teleportPoint     = null;
        this.worldTransform    = new TransformNode("World", this.scene);
        this.teleportTransform = new TransformNode("teleportIndicator", this.scene);
        this.teleportTransform.setEnabled( false );
        this.groundMeshes = [];

        this.mirrors = new SmartArray<Mirror>(4);

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

        // Create points for the laser pointer
        var laserPoints = [];
        laserPoints.push(new Vector3(0, 0, 0));
        laserPoints.push(new Vector3(0, 0, 1));

        // Create a laser pointer and make sure it is not pickable
        this.laserPointer            = MeshBuilder.CreateLines("laserPointer", {points: laserPoints}, this.scene);
        this.laserPointer.color      = Color3.White();
        this.laserPointer.alpha      = .5;
        this.laserPointer.visibility = 0;
        this.laserPointer.isPickable = false;

        // Attach the laser pointer to the right controller when it is connected
        xrHelper.input.onControllerAddedObservable.add((inputSource) => {
            if(inputSource.uniqueId.endsWith("right"))
            {
                this.rightController = inputSource;
                this.laserPointer!.parent = this.rightController.pointer;
            }
        });

        // Don't forget to deparent the laser pointer or it will be destroyed!
        xrHelper.input.onControllerRemovedObservable.add((inputSource) => {

            if(inputSource.uniqueId.endsWith("right"))
            {
                this.laserPointer!.parent = null;
                this.laserPointer!.visibility = 0;
            }
        });

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

        // Teleportation Target
        var teleportTarget            = MeshBuilder.CreateTorus("teleTarget", { diameter: 1, thickness: 0.2, tessellation: 20 }, this.scene);
            teleportTarget.isPickable = false;
            teleportTarget.position   = new Vector3(0,0.1,0);
            teleportTarget.parent     = this.teleportTransform;

        var teleportMaterial                 = new StandardMaterial("teleportTarget", this.scene);
            teleportMaterial.specularColor   = Color3.Black();
            teleportMaterial.emissiveColor   = new Color3(0,0.5,1);
            teleportMaterial.backFaceCulling = false;
            teleportTarget.material          = teleportMaterial;

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
        let avatarTask = assetsManager.addMeshTask("avatar task", "", "assets/boneIkAvatars/ybot/ybot.babylon", "");
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
                "mixamorig:LeftHandMiddle4",
                "mixamorig:Head"
            );
            let animationDictionary = new CalibrationAnimationDictionary(
                "YBot_Idle",
                "YBot_TPose",
                "YBot_TPose",
                "YBot_Celebrate"
            );
            this.ikAvatar.registerCalibrationAvatarFromMeshTask(task,
                boneDictionary, animationDictionary, new Vector3(0, 0, 1.5),
                new Vector3(0, 0, 0), Vector3.One().scale(0.01));
        }

        // Load the user mesh and register it with the IKAvatar.
        let userTask = assetsManager.addMeshTask( "user task", "", "assets/boneIkAvatars/xbot/xbot.babylon", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
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
                "mixamorig:LeftHandMiddle4",
                "mixamorig:Head"
            );
            this.ikAvatar.registerUserAvatarFromMeshTask(task,
                boneDictionary, "Xbot_body", "Xbot_body", new Vector3(0, 0, 0), new Vector3(0, -3.14159, 0),
                Vector3.One().scale(1.0));
        }

        let ground = MeshBuilder.CreateGround("Ground", { width:10, height: 10 }, this.scene );
            ground.position = new Vector3( 0, 0.001, 0 );
            ground.overlayColor = new Color3( 0.2, 0.2, 0.25 );
            ground.renderOverlay = true;
        this.groundMeshes.push(ground);

        let redMaterial = new StandardMaterial("red", this.scene);
            redMaterial.diffuseColor = new Color3(1, 0, 0);

        let sphere = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
            sphere.position = new Vector3( 1, 1.5, -1);
            sphere.material = redMaterial;

        // Create the mirrors.

        this.mirrors.push(new Mirror(
            "mirror_1",
            new Vector3(0, 2.5, 5),
            new Vector3(0, Math.PI/2.0 * 0, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        this.mirrors.push(new Mirror(
            "mirror_2",
            new Vector3(5, 2.5, 0),
            new Vector3(0, Math.PI/2.0 * 1, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        this.mirrors.push(new Mirror(
            "mirror_3",
            new Vector3(0, 2.5, -5),
            new Vector3(0, Math.PI/2.0 * 2, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        this.mirrors.push(new Mirror(
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
        this.mirrors.forEach((mirror: Mirror) =>
        {
            mirror.render(sphere);
            mirror.render(ground);
            mirror.render(environment!.skybox!);
            mirror.render(environment!.ground!);
        });

        ground.setParent(this.worldTransform);
        sphere.setParent(this.worldTransform);

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
                    this.mirrors.forEach((mirror: Mirror) =>
                    {
                        mirror.render(mesh);
                    });

                    mesh.isPickable = false;
                });
            }

            // Set each avatar mesh to reflect off the mirrors and stop the default
            // idling animation.
            if (avatarTask)
            {
                avatarTask.loadedMeshes.forEach((mesh) =>
                {
                    this.mirrors.forEach((mirror: Mirror) =>
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

        this.processControllerInput()
    }

    private processControllerInput()
    {
        this.onRightThumbstick(this.rightController?.motionController?.getComponent("xr-standard-thumbstick"));
    }
    private onRightThumbstick(component?: WebXRControllerComponent)
    {
        if(component?.changes.axes)
        {
        // If the thumbstick is moved forward
        if(component.axes.y < -.75)
        {
            // Create a new ray cast
            var ray = new Ray(this.rightController!.pointer.position, this.rightController!.pointer.forward, 20);
            var pickInfo = this.scene.pickWithRay(ray);

            // If the ray cast intersected a ground mesh
            if(pickInfo?.hit && this.groundMeshes.includes(pickInfo.pickedMesh!))
            {
                this.teleportPoint            = pickInfo.pickedPoint;
                this.laserPointer!.scaling.z  = pickInfo.distance;
                this.laserPointer!.visibility = 1;
                if(pickInfo.pickedPoint)
                {
                    this.teleportTransform.position = pickInfo.pickedPoint;
                    this.teleportTransform.setEnabled(true);
                }
            }
            else
            {
                this.teleportPoint              = null;
                this.laserPointer!.visibility   = 0;
                this.teleportTransform.position = Vector3.Zero();
                this.teleportTransform.setEnabled(false);
            }
        }
        // If thumbstick returns to the rest position
        else if(component.axes.y == 0)
        {
            this.laserPointer!.visibility = 0;

            // If we have a valid targer point, then teleport the user
            if(this.teleportPoint)
            {
                this.worldTransform.position.x -= this.teleportPoint.x;
                this.worldTransform.position.z -= this.teleportPoint.z;
                let mirrorPosition   = this.teleportPoint.clone();
                    mirrorPosition.y = 0;

                this.teleportPoint = null;

                // var cameraRotation = Quaternion.FromEulerAngles(0, this.teleportRot.y, 0);
                // this.worldTransform.rotation.y -= this.teleportRot.y;
                this.mirrors.forEach((mirror: Mirror) =>
                {
                    mirror.update( mirrorPosition, this.worldTransform.rotation, this.scene);
                });

                this.teleportTransform.setEnabled(false);
            }
        }
        }
    }
}
