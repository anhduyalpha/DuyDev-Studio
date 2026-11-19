plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "vn.alphadaniel.duydevstudio"
    compileSdk = 34

    defaultConfig {
        applicationId = "vn.alphadaniel.duydevstudio"
        minSdk = 24
        targetSdk = 34
        versionCode = 2550
        versionName = "25.5.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            storeFile = file("duydev-release.keystore")
            storePassword = "anhduy123"
            keyAlias = "duydevstudio"
            keyPassword = "anhduy123"
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    // WorkManager & Background Streaming
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    testImplementation("junit:junit:4.13.2")
}

val syncWebBootAssets by tasks.registering(Sync::class) {
    val webRoot = file("${project.rootDir}/..")
    val targetDir = file("src/main/assets/www")
    onlyIf { file("$webRoot/index.html").exists() && file("$webRoot/src").exists() }
    from(webRoot) {
        include("index.html", "manifest.webmanifest", "sw.js")
    }
    from("$webRoot/src") {
        into("src")
        include("**/*")
    }
    into(targetDir)
    doLast {
        val manifestFile = file("$targetDir/_boot_manifest.txt")
        val relPaths = mutableListOf<String>()
        targetDir.walkTopDown().forEach { f ->
            if (f.isFile && f.name != "_boot_manifest.txt") {
                val rel = f.relativeTo(targetDir).invariantSeparatorsPath
                relPaths.add(rel)
            }
        }
        manifestFile.writeText(relPaths.sorted().joinToString("\n"), Charsets.UTF_8)
    }
}

tasks.named("preBuild") {
    dependsOn(syncWebBootAssets)
}
