export class AvatarMeasurements
{
    height: number = 0;  // from bottom of foot to top of head.

    shoulderHeight: number = 0;  // from bottom of foot to shoulders.
    eyeHeight: number = 0;  // from bottom of foot to eyes.
    shoulderToEyeOffset: number = 0;  // from shoulders to eyes.

    chestWidth: number = 0;  // from shoulder to shoulder.
    leftShoulderOffset: number = 0;  // from center to left shoulder.
    rightShoulderOffset: number = 0;  // from center to right shoulder.

    foreArmLength: number = 0;  // from shoulder to forearm.
    upperArmLength: number = 0;  // from forearm to wrist.
    armLength: number = 0;  // from shoulder to fingertip.
    armSpan: number = 0;  // from fingertip to fingertip.

    static DeriveFromEyeHeight(eyeHeight: number): AvatarMeasurements
    {
        // return AvatarMeasurements.DeriveFromEyeHeightVesuvian(eyeHeight);
        // return AvatarMeasurements.DeriveFromEyeHeightOpenLab(eyeHeight);
        return AvatarMeasurements.DeriveFromEyeHeightEyeballed(eyeHeight);
    }

    // Approximate the measurements from the ratios in Leonardo Da Vinci's "Vesuvian Man".
    static DeriveFromEyeHeightVesuvian(eyeHeight: number): AvatarMeasurements
    {
        const EYE_HEIGHT_TO_HEIGHT: number = 0.935;
        const SHOULDER_HEIGHT_TO_HEIGHT: number = 0.815;
        const ARMSPAN_TO_HEIGHT: number = 1.0;
        const CHEST_TO_ARMSPAN: number = 0.24;
        const ARM_TO_ARMSPAN: number = (1.0 - CHEST_TO_ARMSPAN)/2.0;
        const FORE_ARM_TO_ARM: number = 0.4;
        const UPPER_ARM_TO_ARM: number = 0.33;

        const m: AvatarMeasurements = new AvatarMeasurements();

        const height = eyeHeight / EYE_HEIGHT_TO_HEIGHT;
        m.height = height;

        m.shoulderHeight = m.height * SHOULDER_HEIGHT_TO_HEIGHT;
        m.eyeHeight = m.height * EYE_HEIGHT_TO_HEIGHT;
        m.shoulderToEyeOffset = m.eyeHeight - m.shoulderHeight;

        m.armSpan = m.height * ARMSPAN_TO_HEIGHT;
        m.chestWidth = m.armSpan * CHEST_TO_ARMSPAN;
        m.leftShoulderOffset = -m.chestWidth/2.0;
        m.rightShoulderOffset = m.chestWidth/2.0;

        m.armLength = m.armSpan * ARM_TO_ARMSPAN;
        m.foreArmLength = m.armLength * FORE_ARM_TO_ARM;
        m.upperArmLength = m.armLength * UPPER_ARM_TO_ARM;

        return m;
    }

    // Approximate the measurements from the ratios described in the OpenLab link.
    // https://www.openlab.psu.edu/design-tools-proportionality-constants/
    static DeriveFromEyeHeightOpenLab(eyeHeight: number): AvatarMeasurements
    {
        const EYE_HEIGHT_TO_HEIGHT: number = 0.9333;
        const SHOULDER_HEIGHT_TO_HEIGHT: number = 0.818;
        const CHEST_TO_HEIGHT: number = 0.259;
        const UPPER_ARM_TO_HEIGHT: number = 0.186;
        const LOWER_ARM_TO_HEIGHT: number = 0.146;
        const HAND_TO_HEIGHT: number = 0.108;

        const m: AvatarMeasurements = new AvatarMeasurements();

        const height = eyeHeight / EYE_HEIGHT_TO_HEIGHT;
        m.height = height;

        m.shoulderHeight = m.height * SHOULDER_HEIGHT_TO_HEIGHT;
        m.eyeHeight = m.height * EYE_HEIGHT_TO_HEIGHT;
        m.shoulderToEyeOffset = m.eyeHeight - m.shoulderHeight;

        m.chestWidth = m.height * CHEST_TO_HEIGHT;
        m.leftShoulderOffset = -m.chestWidth/2.0;
        m.rightShoulderOffset = m.chestWidth/2.0;

        m.foreArmLength = m.height * LOWER_ARM_TO_HEIGHT;
        m.upperArmLength = m.height * UPPER_ARM_TO_HEIGHT;
        m.armLength = m.foreArmLength + m.upperArmLength;
        m.armSpan = m.chestWidth + 2.0*m.armLength;

        return m;
    }

    // Eyeballed with what felt right to me.
    static DeriveFromEyeHeightEyeballed(eyeHeight: number): AvatarMeasurements
    {
        const EYE_HEIGHT_TO_HEIGHT: number = 0.9333;
        const SHOULDER_HEIGHT_TO_HEIGHT: number = 0.818;
        const CHEST_TO_HEIGHT: number = 0.15;
        const UPPER_ARM_TO_HEIGHT: number = 0.18;
        const LOWER_ARM_TO_HEIGHT: number = 0.16;
        const HAND_TO_HEIGHT: number = 0.108;

        const m: AvatarMeasurements = new AvatarMeasurements();

        const height = eyeHeight / EYE_HEIGHT_TO_HEIGHT;
        m.height = height;

        m.shoulderHeight = m.height * SHOULDER_HEIGHT_TO_HEIGHT;
        m.eyeHeight = m.height * EYE_HEIGHT_TO_HEIGHT;
        m.shoulderToEyeOffset = m.eyeHeight - m.shoulderHeight;

        m.chestWidth = m.height * CHEST_TO_HEIGHT;
        m.leftShoulderOffset = -m.chestWidth/2.0;
        m.rightShoulderOffset = m.chestWidth/2.0;

        m.foreArmLength = m.height * LOWER_ARM_TO_HEIGHT;
        m.upperArmLength = m.height * UPPER_ARM_TO_HEIGHT;
        m.armLength = m.foreArmLength + m.upperArmLength;
        m.armSpan = m.chestWidth + 2.0*m.armLength;

        return m;
    }
}
