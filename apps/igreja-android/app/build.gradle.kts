plugins {
    id("com.android.application")
}

android {
    namespace = "br.com.mbalabs.igreja"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.mbalabs.igreja"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}
