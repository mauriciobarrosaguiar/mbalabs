plugins {
    id("com.android.application")
}

val appVersionName = "1.0.2"
val versionParts = appVersionName.split(".").map { it.toIntOrNull() ?: 0 }
val appVersionCode =
    (versionParts.getOrElse(0) { 0 } * 10_000) +
    (versionParts.getOrElse(1) { 0 } * 100) +
    versionParts.getOrElse(2) { 0 }

val releaseKeystorePath = providers.environmentVariable("ELSHADAY_KEYSTORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("ELSHADAY_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ELSHADAY_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ELSHADAY_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(
    releaseKeystorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { !it.isNullOrBlank() }

android {
    namespace = "br.com.mbalabs.igreja"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.mbalabs.igreja"
        minSdk = 26
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }
}
