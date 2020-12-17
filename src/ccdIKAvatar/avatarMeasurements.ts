// Approximated from Leonardo Da Vinci's "Vesuvian Man".
const EYE_HEIGHT_TO_HEIGHT: number = 0.935;
const SHOULDER_HEIGHT_TO_HEIGHT: number = 0.815;
const ARMSPAN_TO_HEIGHT: number = 1.0;
const CHEST_TO_ARMSPAN: number = 0.2;
const ARM_TO_ARMSPAN: number = (1.0 - CHEST_TO_ARMSPAN)/2.0;
const FORE_ARM_TO_ARM: number = 0.4;
const UPPER_ARM_TO_ARM: number = 0.4;

export class AvatarMeasurements
{
    height: number = 1;  // from bottom of foot to top of head.

    shoulderHeight: number = 1;  // from bottom of foot to shoulders.
    eyeHeight: number = 1;  // from bottom of foot to eyes.
    shoulderToEyeOffset: number = 1;  // from shoulders to eyes.

    chestWidth: number = 1;  // from shoulder to shoulder.
    leftShoulderOffset: number = 1;  // from center to left shoulder.
    rightShoulderOffset: number = 1;  // from center to right shoulder.

    foreArmLength: number = 1;  // from shoulder to forearm.
    upperArmLength: number = 1;  // from forearm to wrist.
    armLength: number = 1;  // from shoulder to controller.
    armSpan: number = 1;  // from controller to controller.

    constructor(eyeHeight: number)
    {
        this.deriveFromEyeHeight(eyeHeight);
    }

    deriveFromEyeHeight(eyeHeight: number): void
    {
        this.height = eyeHeight / EYE_HEIGHT_TO_HEIGHT;

        this.shoulderHeight = this.height * SHOULDER_HEIGHT_TO_HEIGHT;
        this.eyeHeight = this.height * EYE_HEIGHT_TO_HEIGHT;
        this.shoulderToEyeOffset = this.eyeHeight - this.shoulderHeight;

        this.armSpan = this.height * ARMSPAN_TO_HEIGHT;
        this.chestWidth = this.armSpan * CHEST_TO_ARMSPAN;
        this.leftShoulderOffset = -this.chestWidth/2.0;
        this.rightShoulderOffset = this.chestWidth/2.0;

        this.armLength = this.armSpan * ARM_TO_ARMSPAN;
        this.foreArmLength = this.armLength * FORE_ARM_TO_ARM;
        this.upperArmLength = this.armLength * UPPER_ARM_TO_ARM;
    }

    deriveArmLengthsFromArmSpan(armSpan: number): void
    {
        this.foreArmLength = armSpan * FORE_ARM_TO_ARM * ARM_TO_ARMSPAN;
        this.upperArmLength = armSpan * UPPER_ARM_TO_ARM * ARM_TO_ARMSPAN;
    }
}
