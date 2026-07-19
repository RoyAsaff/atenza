allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

// flutter_windowmanager_plus (and possibly other plugins) still declare
// compileSdk 33, which is incompatible with newer androidx dependencies
// that require compileSdk 34+. Force all Android library subprojects to
// compile against the same SDK version as the app. Must be registered
// before evaluationDependsOn(":app") below forces eager evaluation.
subprojects {
    afterEvaluate {
        if (project.plugins.hasPlugin("com.android.library")) {
            val androidExtension = project.extensions.findByName("android")
            if (androidExtension is com.android.build.gradle.LibraryExtension) {
                androidExtension.compileSdk = 34
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
