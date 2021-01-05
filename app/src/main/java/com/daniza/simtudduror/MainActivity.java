package com.daniza.simtudduror;

import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import android.os.Bundle;
import android.view.View;

import com.daniza.simtudduror.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding=ActivityMainBinding.inflate(getLayoutInflater());
        View view=binding.getRoot();
        setContentView(view);

        gotoFragment(new HomeFragment(),null);
    }

    @Override
    protected void onResume() {
        //TODO: Tampilkan Iklan
        super.onResume();
    }

    @Override
    protected void onDestroy() {
        binding=null;
        super.onDestroy();
    }

    private void gotoFragment(Fragment fragment, Bundle bundle){
        fragment.setArguments(bundle);
        getSupportFragmentManager().beginTransaction()
                .replace(binding.container.getId(),fragment)
                .commit();
    }
}