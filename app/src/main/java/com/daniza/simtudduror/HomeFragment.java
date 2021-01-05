package com.daniza.simtudduror;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import com.daniza.simtudduror.databinding.FragmentHomeBinding;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.GridLayoutManager;

public class HomeFragment extends BaseFragment<FragmentHomeBinding> {
    private ListAdapter mAdapter;
    private String[] mIcons;
    private String[] mNames;
    private int[] mImages={
            R.drawable.masjid_sophia,
            R.drawable.habibal,
            R.drawable.sholawat,
            R.drawable.masjid_sophia,
            R.drawable.habibal,
            R.drawable.sholawat
    };

    @Override
    protected FragmentHomeBinding setBinding(LayoutInflater inflater, ViewGroup container, Boolean attachToParent) {
        return FragmentHomeBinding.inflate(inflater,container,attachToParent);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        mIcons=getMainActivity().getResources().getStringArray(R.array.icon_list_name);
        mNames=getMainActivity().getResources().getStringArray(R.array.list_name);

        //TODO: SHOW LIST
        binding.rvList.setHasFixedSize(false);
        binding.rvList.setNestedScrollingEnabled(false);
        binding.rvList.setLayoutManager(new GridLayoutManager(getMainActivity(),3));
        mAdapter=new ListAdapter(mNames,mIcons,(position)->{
            Bundle bundle=new Bundle();
            bundle.putInt("IMAGE",mImages[position]);
            getMainActivity().gotoFragment(new ReadFragment(),bundle,true);
        });
        binding.rvList.setAdapter(mAdapter);
    }
}
