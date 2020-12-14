import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math";

import { Utilities } from "./utilities";

export class XRLogger
{
    private text: TextBlock;
    private root: TransformNode;

    constructor(scene: Scene, position: Vector3, rotation: Vector3, scaling: Vector3, parent: TransformNode | null)
    {
        this.root = new TransformNode("XRLogger_root", scene);
        this.root.setParent(parent);
        this.root.position = position;
        this.root.rotation = rotation;
        this.root.scaling = scaling;

        const plane = MeshBuilder.CreatePlane("XRLogger", {
            width: 1,
            height: 1
        }, scene);
        plane.setParent(this.root);
        Utilities.ResetTransform(plane);
        plane.isPickable = false;

        const RES: number = 2048;
        const ASPECT: number = this.root.scaling.x / this.root.scaling.y;

        const texture: AdvancedDynamicTexture = AdvancedDynamicTexture.CreateForMesh(plane, RES, RES/ASPECT);
        texture.background = "#000000";

        this.text = new TextBlock();
        this.text.text = "XRLogger";
        this.text.color = "#ffffff";
        this.text.fontSize = 48;
        this.text.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        this.text.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP;

        texture.addControl(this.text);
    }

    log(message: string, replace: boolean): void
    {
        if (replace)
        {
            this.text.text = message;
        }
        else
        {
            this.text.text += "\n" + message;
        }
    }
}
