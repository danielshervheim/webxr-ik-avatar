/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

// Mirror imports.
import { Mirror } from "./mirror";

import { CCD, IKSolver, TargetTriangle } from "./ikSolver";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, SmartArray } from "@babylonjs/core";
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

    private xrCamera: WebXRCamera | null = null;
    private leftController: WebXRInputSource | null = null;
    private rightController: WebXRInputSource | null = null;

    private root: AbstractMesh;
    private head: AbstractMesh;
    private lShoulder: AbstractMesh;
    private rShoulder: AbstractMesh;
    private lElbow: AbstractMesh;
    private rElbow: AbstractMesh;
    private lWrist: AbstractMesh;
    private rWrist: AbstractMesh;

    private skeletonMeshes: Array<AbstractMesh>;

    private solver: IKSolver;

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        let redMaterial = new StandardMaterial("red", this.scene);
            redMaterial.diffuseColor = new Color3(1, 0, 0);

        let blueMaterial = new StandardMaterial("blue", this.scene);
            blueMaterial.diffuseColor = new Color3(0, 0, 1);


        let whiteMaterial = new StandardMaterial("blue", this.scene);
            whiteMaterial.diffuseColor = new Color3(1, 1, 1);

        const height = 1.68;
        const shoulderHeight = height*0.8;

        const armSpan = height;
        const chestWidth = armSpan*0.2;

        const totalArmLength = (armSpan - chestWidth)/2.0;
        const upperArmLength = totalArmLength*0.5;
        const lowerArmLength = totalArmLength*0.5;

        // Create the guides.
        this.root = MeshBuilder.CreateCylinder("Root", {diameterTop: 0.0, diameterBottom: 0.075, height: 0.1}, this.scene);
        this.root.position = new Vector3(0, shoulderHeight, 0);
        this.root.material = whiteMaterial;

        const rootForwardIndicator = MeshBuilder.CreateCylinder("Root Forward Indicator", {diameterTop: 0.0, diameterBottom: 0.15, height:0.2}, this.scene);
        rootForwardIndicator.material = whiteMaterial;
        rootForwardIndicator.setParent(this.root);
        rootForwardIndicator.position = new Vector3(0, -0.2, 0.2);
        rootForwardIndicator.rotation = new Vector3(Math.PI/2.0, 0, 0);

        this.head = MeshBuilder.CreateCylinder("Head", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.head.setParent(this.root);
        this.head.rotation = Vector3.Zero();
        this.head.position = new Vector3(0, height-shoulderHeight, 0);
        this.head.material = whiteMaterial;

        this.lShoulder = MeshBuilder.CreateCylinder("LeftShoulder", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.lShoulder.setParent(this.root);
        this.lShoulder.rotation = new Vector3(0, 0, Math.PI/2.0);
        this.lShoulder.position = new Vector3(-chestWidth/2.0, 0, 0);
        this.lShoulder.material = blueMaterial;

        this.rShoulder = MeshBuilder.CreateCylinder("RightShoulder", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.rShoulder.setParent(this.root);
        this.rShoulder.rotation = new Vector3(0, 0, -Math.PI/2.0);
        this.rShoulder.position = new Vector3(chestWidth/2.0, 0, 0);
        this.rShoulder.material = redMaterial;

        this.lElbow = MeshBuilder.CreateCylinder("LeftElbow", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.lElbow.setParent(this.lShoulder);
        this.lElbow.rotation = Vector3.Zero();
        this.lElbow.position = new Vector3(0, upperArmLength, 0);
        this.lElbow.material = blueMaterial;

        this.rElbow = MeshBuilder.CreateCylinder("RightElbow", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.rElbow.setParent(this.rShoulder);
        this.rElbow.rotation = Vector3.Zero();
        this.rElbow.position = new Vector3(0, upperArmLength, 0);
        this.rElbow.material = redMaterial;

        this.lWrist = MeshBuilder.CreateCylinder("LeftWrist", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.lWrist.setParent(this.lElbow);
        this.lWrist.rotation = Vector3.Zero();
        this.lWrist.position = new Vector3(0, lowerArmLength, 0);
        this.lWrist.material = whiteMaterial;

        this.rWrist = MeshBuilder.CreateCylinder("RightWrist", {diameterTop: 0.0, diameterBottom: 0.075, height:0.1}, this.scene);
        this.rWrist.setParent(this.rElbow);
        this.rWrist.rotation = Vector3.Zero();
        this.rWrist.position = new Vector3(0, lowerArmLength, 0);
        this.rWrist.material = whiteMaterial;

        this.skeletonMeshes = [
            this.root,
            rootForwardIndicator,
            this.head,
            this.lShoulder,
            this.lElbow,
            this.lWrist,
            this.rShoulder,
            this.rElbow,
            this.rWrist];

        for (let mesh of this.skeletonMeshes)
        {
            mesh.setEnabled(false);
        }

        this.solver = new CCD(this.engine);
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
        const playerMeshes = [this.head, this.lShoulder, this.lElbow, this.lWrist, this.rShoulder, this.rElbow, this.rWrist];


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

        this.xrCamera = xrHelper.baseExperience.camera;

        xrHelper.enterExitUI.activeButtonChangedObservable.add((enterExit) =>
        {
            for (let mesh of this.skeletonMeshes)
            {
                mesh.setEnabled(enterExit != null);
            }
        });

        // Assign the controllers.
        xrHelper.input.onControllerAddedObservable.add((inputSource: WebXRInputSource) =>
        {
            if (inputSource.uniqueId.endsWith("left"))
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

        // Create an AssetManager to load in data.
        let assetsManager = new AssetsManager(this.scene);

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
            for (let mesh of this.skeletonMeshes)
            {
                mirror.render(mesh);
            }
        });

        this.scene.debugLayer.show();
    }

    private lookRotation(forward: Vector3, up: Vector3) : Quaternion
    {
        let result = Matrix.Zero();
        Matrix.LookAtLHToRef(Vector3.Zero(), forward, new Vector3(0,1,0), result);
        result.invert();
        return Quaternion.FromRotationMatrix(result);
    }

    private update() : void
    {
        if (this.xrCamera)
        {
            // TODO: set at xr camera y position???
            // No, because the root is at the base of the neck, not the eyes.
            this.root.position = new Vector3(
                this.xrCamera.position.x,
                this.root.position.y,
                // this.xrCamera.position.y,
                this.xrCamera.position.z);
        }

        if (this.leftController && this.rightController && this.xrCamera)
        {
            // Compute the vector from the left to right controllers in the XZ plane.
            let averageControllerRight = this.rightController.pointer.absolutePosition.subtract(this.leftController.pointer.absolutePosition);
            averageControllerRight.y = 0.0;
            averageControllerRight.normalize();

            // Compute the vector pointing perpendicular to the line formed by
            // the two controllers, in the XZ plane.
            let averageControllerForward = Vector3.Cross(averageControllerRight, Vector3.Up());
            averageControllerForward.y = 0.0;
            averageControllerForward.normalize();

            // Compute the XR camera forward vector in the XZ plane.
            let cameraForward = this.xrCamera.getDirection(Vector3.Forward());
            cameraForward.y = 0.0;
            cameraForward.normalize();

            // Generate quaternion rotations from the two forward vectors.
            let averageControllerRotation = this.lookRotation(averageControllerForward, Vector3.Up());
            let cameraRotation = this.lookRotation(cameraForward, Vector3.Up());

            // TODO: determine if arms are swapped by telling if lController.x >
            // rController.x in relation to the cameraForward line. The below is
            // just a hack, and not a very good one...
            // It should be "rot = averageControllerRotation if arms not swapped, else cameraRotation"
            this.root.rotationQuaternion = Quaternion.Slerp(averageControllerRotation, cameraRotation, 0.25);
        }


        const limits = [Math.PI/1.5, Math.PI/1.5, Math.PI/1.5];

        if (this.leftController)
        {
            const chain = [this.lShoulder, this.lElbow, this.lWrist];
            const target = this.leftController.pointer.absolutePosition;
            this.solver.solve(chain, limits, target, 1, 25.0);
        }

        if (this.rightController)
        {
            const chain = [this.rShoulder, this.rElbow, this.rWrist];
            const target = this.rightController.pointer.absolutePosition;
            this.solver.solve(chain, limits, target, 1, 25.0);
        }

    }
}
